import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect, WebSocketServer } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws'; // <-- Simplified import fixes the constructable error

@WebSocketGateway()
export class GeminiAudioGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private geminiWs!: WebSocket;

  handleConnection(client: WebSocket) {
    const apiKey = process.env.GEMINI_API_KEY;
    // Connect directly to the Gemini Multimodal Live API v1alpha
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    
    // Now TypeScript knows this is the WebSocket class constructor
    this.geminiWs = new WebSocket(url);
    this.geminiWs.on('error', (error) => console.error("❌ Gemini Error:", error));
    this.geminiWs.on('close', (code, reason) => console.log("⚠️ Gemini Closed:", code, reason.toString()));

    this.geminiWs.on('open', () => {
      // Step 1: Initialize session with persona and UI tools
      console.log("Connected to Gemini!");
      this.geminiWs.send(JSON.stringify({
        setup: {
          model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
          generationConfig: {
            responseModalities: ["AUDIO"]
          },
          systemInstruction: {
            parts: [{ text: "You are a cheerful, friendly cartoon dog talking to a young child about the park image on their screen. Keep responses under 10 seconds. The conversation will automatically end after 1 minute, so wrap it up warmly when you get close to that time. If the child mentions a color, use the 'change_background_color' tool." }]
          },
          tools: [{
            functionDeclarations: [{
              name: "change_background_color",
              description: "Changes the background color of the UI based on the child's preference.",
              parameters: {
                type: "OBJECT",
                properties: { color: { type: "STRING", description: "A valid CSS color" } },
                required: ["color"]
              }
            }]
          }]
        }
      }));
    });

    this.geminiWs.on('message', (data) => {
      const event = JSON.parse(data.toString());
      console.log("Gemini sent event type:", Object.keys(event)[0]);
      
      // Step 2: Forward Gemini's native audio back to React
      if (event.serverContent?.modelTurn) {
        const parts = event.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
             client.send(JSON.stringify({ type: 'audio', audioBase64: part.inlineData.data }));
          }
        }
      }
      
      // Step 3: Intercept Tool Call to update the UI
      if (event.toolCall?.functionCalls) {
        for (const call of event.toolCall.functionCalls) {
          if (call.name === 'change_background_color') {
            const color = call.args.color;
            
            // Tell React to update the screen
            client.send(JSON.stringify({ 
              type: 'tool_call', 
              action: 'change_background_color', 
              payload: color 
            }));
            
            // Acknowledge the tool execution back to Gemini so it continues talking
            this.geminiWs.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: call.id,
                  name: call.name,
                  response: { result: `Successfully changed screen color to ${color}!` }
                }]
              }
            }));
          }
        }
      }
    });

    // Step 4: Receive raw audio from React and stream to Gemini
    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'audio_input') {
        this.geminiWs.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=16000",
              data: message.audioBase64
            }]
          }
        }));
      }
    });
  }

  handleDisconnect(client: WebSocket) {
    if (this.geminiWs) this.geminiWs.close();
  }
}