import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      console.error("No audio file in request");
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("ElevenLabs API key not configured");
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    console.log("Audio file received:", {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size,
    });

    // Convert file to buffer for server-side FormData
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create form data for ElevenLabs
    const elevenLabsFormData = new FormData();
    
    // Create a proper Blob with the buffer
    const audioBlob = new Blob([buffer], { type: audioFile.type });
    elevenLabsFormData.append(
      "file",  // ElevenLabs expects "file" not "audio"
      audioBlob,
      audioFile.name || "recording.webm"
    );
    elevenLabsFormData.append("model_id", "scribe_v2");

    console.log("Sending request to ElevenLabs...");

    // Call ElevenLabs Speech-to-Text API
    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: elevenLabsFormData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return NextResponse.json(
        { error: `Transcription failed: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Transcription successful:", data);
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
