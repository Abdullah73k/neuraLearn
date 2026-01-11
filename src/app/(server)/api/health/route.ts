import { NextResponse } from "next/server";

// Health check endpoint - supports both GET and POST methods
export async function GET() {
	try {
		return NextResponse.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			service: "neuraLearn",
			version: "1.0.0"
		});
	} catch {
		return NextResponse.json(
			{
				status: "unhealthy",
				timestamp: new Date().toISOString(),
				error: "Service health check failed"
			},
			{ status: 500 }
		);
	}
}

export async function POST() {
	// Support POST for legacy compatibility
	return GET();
}
