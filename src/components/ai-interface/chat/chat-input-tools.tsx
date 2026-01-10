import { GlobeIcon } from "lucide-react";
import {
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputButton,
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
	PromptInputSpeechButton,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Dispatch, RefObject, SetStateAction } from "react";

type ChatInputToolsProps = {
	model: string;
	setModel: Dispatch<SetStateAction<string>>;
	webSearch: boolean;
	setWebSearch: Dispatch<SetStateAction<boolean>>;
	models: {
		name: string;
		value: string;
	};
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
};

export default function ChatInputTools({
	model,
	setModel,
	webSearch,
	setWebSearch,
	models,
	textareaRef,
}: ChatInputToolsProps) {
	return (
		<PromptInputTools>
			<PromptInputActionMenu>
				<PromptInputActionMenuTrigger />
				<PromptInputActionMenuContent>
					<PromptInputActionAddAttachments />
				</PromptInputActionMenuContent>
			</PromptInputActionMenu>
			<PromptInputSpeechButton textareaRef={textareaRef} />
			<PromptInputButton
				variant={webSearch ? "default" : "ghost"}
				onClick={() => setWebSearch(!webSearch)}
			>
				<GlobeIcon size={16} />
				<span>Search</span>
			</PromptInputButton>
			<PromptInputSelect
				onValueChange={(value) => {
					setModel(value);
				}}
				value={model}
			>
				<PromptInputSelectTrigger>
					<PromptInputSelectValue />
				</PromptInputSelectTrigger>
				<PromptInputSelectContent>
					<PromptInputSelectItem value={models.value}>
						{models.name}
					</PromptInputSelectItem>
				</PromptInputSelectContent>
			</PromptInputSelect>
		</PromptInputTools>
	);
}
