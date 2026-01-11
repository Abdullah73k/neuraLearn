"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
	useGetActiveWorkspace,
	useGetCurrentRelationType,
	useMindMapActions,
} from "@/store/hooks";
import {
	MicIcon,
	SquareIcon,
	Loader2Icon,
	CheckIcon,
	XIcon,
	Volume2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RelationType } from "@/types/edges";

type CommandType =
	| "create_node"
	| "delete_node"
	| "copy_response"
	| "navigate_to"
	| "connect_nodes"
	| "unknown";

type ClassifiedCommand = {
	command: CommandType;
	params: Record<string, string>;
	confidence: number;
	explanation: string;
};

type GlobalMicState = "idle" | "recording" | "processing" | "confirming";

export default function GlobalMic() {
	const [state, setState] = useState<GlobalMicState>("idle");
	const [transcription, setTranscription] = useState<string>("");
	const [command, setCommand] = useState<ClassifiedCommand | null>(null);
	const [error, setError] = useState<string | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const activeWorkspace = useGetActiveWorkspace();
	const currentRelationType = useGetCurrentRelationType();
	const {
		setSelectedNode,
		deleteNode,
		createSubtopicNode,
		onConnectForActive,
	} = useMindMapActions();

	// Get nodes for context
	const nodes = activeWorkspace?.nodes || [];
	const nodeInfos = nodes.map((n) => ({
		id: n.id,
		title: n.data.title,
		type: n.type,
	}));

	const startRecording = useCallback(async () => {
		try {
			setError(null);
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: "audio/webm",
			});
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunksRef.current.push(event.data);
				}
			};

			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((track) => track.stop());
				await processRecording();
			};

			mediaRecorder.start();
			setState("recording");
		} catch (err) {
			console.error("Failed to start recording:", err);
			setError("Failed to access microphone");
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (mediaRecorderRef.current && state === "recording") {
			mediaRecorderRef.current.stop();
			setState("processing");
		}
	}, [state]);

	const processRecording = async () => {
		try {
			const audioBlob = new Blob(audioChunksRef.current, {
				type: "audio/webm",
			});

			// Step 1: Transcribe
			const transcribeFormData = new FormData();
			transcribeFormData.append("audio", audioBlob, "recording.webm");

			const transcribeResponse = await fetch("/api/transcribe", {
				method: "POST",
				body: transcribeFormData,
			});

			if (!transcribeResponse.ok) {
				throw new Error("Transcription failed");
			}

			const transcribeData = await transcribeResponse.json();
			const transcribedText = transcribeData.text;
			setTranscription(transcribedText);

			// Step 2: Classify command
			const classifyResponse = await fetch("/api/classify-command", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					transcription: transcribedText,
					nodes: nodeInfos,
					currentRelationType,
				}),
			});

			if (!classifyResponse.ok) {
				throw new Error("Command classification failed");
			}

			const classifiedCommand: ClassifiedCommand =
				await classifyResponse.json();
			setCommand(classifiedCommand);
			setState("confirming");
		} catch (err) {
			console.error("Processing error:", err);
			setError(err instanceof Error ? err.message : "Processing failed");
			setState("idle");
		}
	};

	const executeCommand = useCallback(async () => {
		if (!command || !activeWorkspace) return;

		try {
			switch (command.command) {
				case "create_node": {
					const sourceId = command.params.source_node_id;
					const newTitle = command.params.new_node_title || "New Node";

					// Create new subtopic node
					const newNodeId = crypto.randomUUID();
					const sourceNode = nodes.find((n) => n.id === sourceId);
					const newPosition = sourceNode
						? { x: sourceNode.position.x + 200, y: sourceNode.position.y + 100 }
						: { x: 200, y: 200 };

					// We need to manually add the node and edge
					const { useMindMapStore } = await import("@/store/store");
					const state = useMindMapStore.getState();

					if (!state.activeWorkspaceId) break;

					const workspace = state.workspaces.find(
						(w) => w.id === state.activeWorkspaceId
					);
					if (!workspace) break;

					const newNode = {
						id: newNodeId,
						type: "subtopic" as const,
						position: newPosition,
						data: { title: newTitle },
					};

					const newEdge = {
						id: crypto.randomUUID(),
						source: sourceId,
						target: newNodeId,
						type: "mindmap",
						data: { relationType: currentRelationType as RelationType },
					};

					useMindMapStore.setState({
						workspaces: state.workspaces.map((w) =>
							w.id === state.activeWorkspaceId
								? {
										...w,
										nodes: [...w.nodes, newNode],
										edges: [...w.edges, newEdge],
								  }
								: w
						),
					});
					break;
				}

				case "delete_node": {
					const targetId = command.params.target_node_id;
					if (targetId) {
						deleteNode(targetId);
					}
					break;
				}

				case "copy_response": {
					const targetId = command.params.target_node_id;
					if (targetId && activeWorkspace.messages[targetId]) {
						const messages = activeWorkspace.messages[targetId];
						const lastAssistantMessage = messages
							.filter((m) => m.role === "assistant")
							.pop();
						if (lastAssistantMessage) {
							const textPart = lastAssistantMessage.parts.find(
								(p) => p.type === "text"
							);
							if (textPart && "text" in textPart) {
								await navigator.clipboard.writeText(textPart.text);
							}
						}
					}
					break;
				}

				case "navigate_to": {
					const targetId = command.params.target_node_id;
					const targetNode = nodes.find((n) => n.id === targetId);
					if (targetNode) {
						setSelectedNode(targetNode);
					}
					break;
				}

				case "connect_nodes": {
					const sourceId = command.params.source_node_id;
					const targetId = command.params.target_node_id;
					if (sourceId && targetId) {
						onConnectForActive({
							source: sourceId,
							target: targetId,
							sourceHandle: null,
							targetHandle: null,
						});
					}
					break;
				}

				default:
					setError("Unknown command");
			}

			// Reset state
			setState("idle");
			setTranscription("");
			setCommand(null);
		} catch (err) {
			console.error("Command execution error:", err);
			setError("Failed to execute command");
		}
	}, [
		command,
		activeWorkspace,
		nodes,
		currentRelationType,
		deleteNode,
		setSelectedNode,
		onConnectForActive,
	]);

	const cancelCommand = useCallback(() => {
		setState("idle");
		setTranscription("");
		setCommand(null);
		setError(null);
	}, []);

	const toggleRecording = useCallback(() => {
		if (state === "idle") {
			startRecording();
		} else if (state === "recording") {
			stopRecording();
		}
	}, [state, startRecording, stopRecording]);

	// Global keyboard shortcut (G key)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger if typing in an input
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			if (
				e.key.toLowerCase() === "g" &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				e.preventDefault();
				toggleRecording();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleRecording]);

	const getCommandDisplayText = () => {
		if (!command) return "";

		switch (command.command) {
			case "create_node":
				const sourceNode = nodes.find(
					(n) => n.id === command.params.source_node_id
				);
				return `Create "${command.params.new_node_title}" from "${
					sourceNode?.data.title || "root"
				}"`;
			case "delete_node":
				const targetNode = nodes.find(
					(n) => n.id === command.params.target_node_id
				);
				return `Delete "${targetNode?.data.title || "node"}"`;
			case "copy_response":
				const copyNode = nodes.find(
					(n) => n.id === command.params.target_node_id
				);
				return `Copy response from "${copyNode?.data.title || "node"}"`;
			case "navigate_to":
				const navNode = nodes.find(
					(n) => n.id === command.params.target_node_id
				);
				return `Navigate to "${navNode?.data.title || "node"}"`;
			case "connect_nodes":
				const srcNode = nodes.find(
					(n) => n.id === command.params.source_node_id
				);
				const destNode = nodes.find(
					(n) => n.id === command.params.target_node_id
				);
				return `Connect "${srcNode?.data.title}" to "${destNode?.data.title}"`;
			default:
				return "Unknown command";
		}
	};

	return (
		<div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-3">
			{/* Transcription & Confirmation Panel */}
			{(state === "confirming" || error) && (
				<div className="bg-background/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl p-4 min-w-[320px] max-w-[480px] animate-in slide-in-from-bottom-4 fade-in duration-300">
					{error ? (
						<div className="text-center">
							<p className="text-destructive text-sm mb-3">{error}</p>
							<Button
								variant="outline"
								size="sm"
								onClick={cancelCommand}
								className="rounded-full"
							>
								Dismiss
							</Button>
						</div>
					) : (
						<>
							{/* Transcription */}
							<div className="mb-3">
								<p className="text-xs text-muted-foreground mb-1">You said:</p>
								<p className="text-sm font-medium">
									&quot;{transcription}&quot;
								</p>
							</div>

							{/* Interpreted Command */}
							<div className="mb-4 p-3 bg-muted/50 rounded-xl">
								<p className="text-xs text-muted-foreground mb-1">
									Interpreted as:
								</p>
								<p className="text-sm font-semibold text-primary">
									{getCommandDisplayText()}
								</p>
								{command && (
									<p className="text-xs text-muted-foreground mt-1">
										Confidence: {Math.round(command.confidence * 100)}%
									</p>
								)}
							</div>

							{/* Actions */}
							<div className="flex justify-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={cancelCommand}
									className="rounded-full gap-2"
								>
									<XIcon className="size-4" />
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={executeCommand}
									className="rounded-full gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
								>
									<CheckIcon className="size-4" />
									Confirm
								</Button>
							</div>
						</>
					)}
				</div>
			)}

			{/* Mic Button */}
			<button
				onClick={toggleRecording}
				disabled={state === "processing"}
				className={cn(
					"relative size-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
					"focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500",
					state === "idle" &&
						"bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 hover:scale-105",
					state === "recording" &&
						"bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 animate-pulse",
					state === "processing" &&
						"bg-gradient-to-br from-amber-500 to-orange-600 cursor-wait",
					state === "confirming" &&
						"bg-gradient-to-br from-violet-500 to-purple-600 opacity-50"
				)}
			>
				{/* Ripple effect when recording */}
				{state === "recording" && (
					<>
						<span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
						<span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20 animation-delay-150" />
					</>
				)}

				{/* Icon */}
				{state === "idle" && <MicIcon className="size-7 text-white" />}
				{state === "recording" && <SquareIcon className="size-6 text-white" />}
				{state === "processing" && (
					<Loader2Icon className="size-7 text-white animate-spin" />
				)}
				{state === "confirming" && <MicIcon className="size-7 text-white" />}
			</button>

			{/* Hint text */}
			<p className="text-xs text-muted-foreground text-center w-[100px] leading-relaxed">
				{state === "idle" && "Press G or click to speak"}
				{state === "recording" && "Listening... Press G or click to stop"}
				{state === "processing" && "Processing..."}
				{state === "confirming" && "Confirm your command"}
			</p>
		</div>
	);
}
