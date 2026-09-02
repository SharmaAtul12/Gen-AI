const API_KEY = "";

let state = {
  currentAudioObj: null,
  audioQueue: [],
  isPlaying: false,
}

async function* llmStreaming(userText = '') {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: userText,
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textContent = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const payload = event
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');

      if (!payload || payload === '[DONE]') continue;

      const parsed = JSON.parse(payload);

      if (parsed.type === 'response.output_text.delta') {
        textContent += parsed.delta;
        yield { textContent, isFinal: false, delta: parsed.delta };
      }

      if (parsed.type === 'response.output_text.done') {
        textContent = parsed.text ?? textContent;
      }
    }
  }

  yield { textContent, isFinal: true, delta: '' };
}


async function llm(userInput="") {
  const response =await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: userInput
    })
  });

  const data = await response.json();

  const textOutput = data.output.flatMap((item) => item.content ?? []).find((content) => content.type === 'output_text');
  return textOutput ? textOutput.text : '';
}

async function speak(text) {
  //! This Will give me a audio file in the form of a blob . 
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      instructions: "Speak in a cheerful, warm and natural tone .",
      input: text
    })
  });

  //* Playing the audio response from the API ...
  const audioBlob = await response.blob();

  //* This Will Push the audio blob into the audio queue, and sath mm ham audio queue ko process karenge, taki audio sequentially play ho sake.
  //* This is important because agar hum audio ko sequentially play nahi karenge, to audio overlapping ho jayega, aur user ko samajh nahi aayega ki kya bola ja raha hai.
  //* So it is like push audio into the queue, and then process the queue to play the audio sequentially.

  state.audioQueue.push(audioBlob);
  
  state.isPlaying = true;
  try {
    while(state.audioQueue.length > 0) {
      const queuedBlob = state.audioQueue.shift();
      const audioUrl = URL.createObjectURL(queuedBlob);
      const audio = new Audio(audioUrl);
      
      await new Promise((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          reject(audio.error ?? new Error('Audio playback error'));
        };
        audio.play().catch(reject);
      })
    }
  } finally {
    state.isPlaying = false;
  }
} 

async function main() {

  //! 1. Speech To Text
  const SpeechRecognition = window.SpeechRecognition;
  const speechRecognition = new SpeechRecognition();

  //* I need continuous recognition, This means that the recognition will not stop after a single result, 
  //* but will continue to listen for more speech input until the user stops it manually.
  speechRecognition.continuous = true;

  //* I need to get the final result of the speech recognition, i dont want word by word results, I want the final result after the user has finished speaking.
  speechRecognition.interimResults = false;

  //* I want to get only one alternative for the recognized speech, I don't want multiple alternatives, I just want the best match.
  speechRecognition.maxAlternatives = 1;

  speechRecognition.onstart = function () {
    console.log('🎤 SpeechRecognition has started');
  };

  speechRecognition.onresult = async function (event) {
    const transcript = event.results[event.results.length - 1][0].transcript;
    console.log('📝 User:', transcript);

    if(state.currentAudioObj) {
      state.currentAudioObj.audio.pause();
      URL.revokeObjectURL(state.currentAudioObj.audioUrl);
      state.currentAudioObj = null;
    }

    for await (const chunk of llmStreaming(transcript)) {
      console.log('💬 Agent Response Chunk:', chunk.delta);
      speak(chunk.delta);
    }

  }

  speechRecognition.start();

}

main();