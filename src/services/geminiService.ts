import { AeroSetup, TelemetryData, TuningAdvice } from "../types";

export async function getAeroAdvice(telemetry: TelemetryData[], currentSetup: AeroSetup): Promise<TuningAdvice | null> {
  const prompt = `
    You are a Lead F1 Race Engineer. Based on the following telemetry and current aero setup, provide structured performance optimization advice.
    
    Current Setup:
    - Front Wing Angle: ${currentSetup.frontWingAngle}°
    - Rear Wing Angle: ${currentSetup.rearWingAngle}°
    - Ride Height: ${currentSetup.rideHeight}mm
    - Brake Balance: ${currentSetup.brakeBalance}%
    
    Latest Telemetry Trends (last 10 samples):
    ${telemetry.slice(-10).map(t => `- Speed: ${t.speed.toFixed(1)} km/h, Downforce: ${t.downforce.toFixed(1)}N, Drag: ${t.drag.toFixed(1)}N`).join('\n')}
    
    Respond STRICTLY in JSON format with this structure:
    {
      "analysis": "Brief analysis of current telemetry performance",
      "suggestions": {
        "frontWingAngle": number,
        "rearWingAngle": number,
        "rideHeight": number,
        "brakeBalance": number
      },
      "reasoning": "Reasoning for these specific changes"
    }

    Rules:
    - Return ONLY the JSON object.
    - Suggestions should be incremental improvements based on current setup.
    - If no change is needed for a field, omit it from the suggestions object.
  `;

  try {
    const response = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || "HTTP error! status: " + response.status);
      } catch (e) {
        if (e instanceof SyntaxError) {
           throw new Error(errorText || "HTTP error! status: " + response.status);
        }
        throw e;
      }
    }
    
    const data = await response.json();
    return data as TuningAdvice;
  } catch (error) {
    console.error("Gemini AI API Error:", error);
    throw error;
  }
}
