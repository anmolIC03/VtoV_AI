import React, { useState, useEffect, useRef } from 'react';

export default function GeminiAdventureApp() {
  const [isRecording, setIsRecording] = useState(false);
  const [bgColor, setBgColor] = useState('#f0f8ff'); 
  const [timeLeft, setTimeLeft] = useState(180); 
  const nextPlayTimeRef = useRef(0); // Tracks when the next audio chunk should play
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  // Enforce the 1-minute conversation limit
  useEffect(() => {
    let timer;
    if (isRecording && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      stopConversation();
    }
    return () => clearInterval(timer);
  }, [isRecording, timeLeft]);

  const startConversation = async () => {
    wsRef.current = new WebSocket('ws://localhost:8081');
    
    // Gemini Output is 24kHz PCM16
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    
    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'audio') {
        playPcm16Audio(data.audioBase64);
      } else if (data.type === 'tool_call' && data.action === 'change_background_color') {
        setBgColor(data.payload); 
      }
    };

    // Setup Microphone Input for Gemini (Needs 16kHz PCM16)
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = micStream;
    
    // Create a temporary context just for resampling mic input to 16kHz
    const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(micStream);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        
        // Convert Float32 audio to Int16
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        // Convert array to Base64
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        wsRef.current.send(JSON.stringify({ 
            type: 'audio_input', 
            audioBase64: btoa(binary) 
        }));
      }
    };

    source.connect(processor);
    processor.connect(inputCtx.destination); // Required to keep the processor firing

    setIsRecording(true);
  };

  const stopConversation = () => {
    if (wsRef.current) wsRef.current.close();
    if (processorRef.current) processorRef.current.disconnect();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setIsRecording(false);
    setTimeLeft(180);
  };

  // Decode and play Gemini's 24kHz base64 audio stream
const playPcm16Audio = (base64) => {
    // 1. Decode Base64
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 2. Convert to Float32
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768; 
    }
    
    // 3. Create Audio Buffer
    const audioBuffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtxRef.current.destination);

    // 4. 🪄 THE MAGIC FIX: Schedule the audio chunks to play back-to-back!
    const currentTime = audioCtxRef.current.currentTime;
    
    // If the audio context is empty or we fell behind, reset the play time to right now
    if (currentTime >= nextPlayTimeRef.current) {
      nextPlayTimeRef.current = currentTime + 0.05; // 50ms buffer to prevent stutter
    }
    
    // Schedule this chunk, then advance the tracker for the next chunk
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration; 
  };
  return (
    <div style={{ 
      backgroundColor: bgColor, 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      transition: 'background-color 0.5s ease'
    }}>
      <h1 style={{ fontFamily: 'sans-serif' }}>Magical AI Adventure</h1>
      
      <img 
        src="https://images.unsplash.com/photo-1566140967404-b8b3932483f5?auto=format&fit=crop&w=600" 
        alt="A magical park scene" 
        style={{ borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', marginBottom: '20px' }} 
      />
      
      <h3 style={{ color: timeLeft <= 10 ? 'red' : 'black' }}>
        Time left: {timeLeft}s
      </h3>
      
      {!isRecording ? (
        <button onClick={startConversation} style={{ padding: '15px 30px', fontSize: '18px', borderRadius: '8px', cursor: 'pointer' }}>
          Start Talking
        </button>
      ) : (
        <button onClick={stopConversation} style={{ padding: '15px 30px', fontSize: '18px', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#ff4444', color: 'white' }}>
          End Adventure
        </button>
      )}
    </div>
  );
}