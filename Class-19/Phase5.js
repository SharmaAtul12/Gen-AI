const API_KEY = "";


let state = {
  currentAudioObj: null,
  audioQueue: [],
  isPlaying: false,
  playbackSession: 0,
}

const BARGE_IN = {
  rmsThreshold: 0.1,
  consecutiveFrames: 5,
};

async function* llmStreaming(userText = '') {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      input: `You are a part of Speech To Text and Text To Speech Pipeline.
      Alwats make sure while streaming to answer in sentences so that ist easiler for me to convert them to Speech as soon as sentence competes.
      User Query:
      ${userText}
      `,
      stream: true,
    }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textContent = '';
  let sentenceBuffer = '';

  function takeSentences(text) {
    const sentences = [];
    let rest = text;

    while (true) {
      const end = rest.search(/[.?]/);
      if (end === -1) break;
      const sentence = rest.slice(0, end + 1).trim();
      rest = rest.slice(end + 1);
      if (sentence) sentences.push(sentence);
    }

    return { sentences, rest };
  }

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
        sentenceBuffer += parsed.delta;

        const { sentences, rest } = takeSentences(sentenceBuffer);
        sentenceBuffer = rest;

        for (const sentence of sentences) {
          yield { textContent, isFinal: false, delta: sentence };
        }
      }

      if (parsed.type === 'response.output_text.done') {
        textContent = parsed.text ?? textContent;
      }
    }
  }

  const leftover = sentenceBuffer.trim();
  if (leftover) {
    yield { textContent, isFinal: true, delta: leftover };
  }
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
  const session = state.playbackSession;
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
  if (session !== state.playbackSession) return;
  //* This Will Push the audio blob into the audio queue, and sath mm ham audio queue ko process karenge, taki audio sequentially play ho sake.
  //* This is important because agar hum audio ko sequentially play nahi karenge, to audio overlapping ho jayega, aur user ko samajh nahi aayega ki kya bola ja raha hai.
  //* So it is like push audio into the queue, and then process the queue to play the audio sequentially.

  state.audioQueue.push(audioBlob);
  if (state.isPlaying) return;

  state.isPlaying = true;

  try {
    while(state.audioQueue.length > 0 && session === state.playbackSession) {
      const queuedBlob = state.audioQueue.shift();
      const audioUrl = URL.createObjectURL(queuedBlob);
      const audio = new Audio(audioUrl);
      
      await new Promise((resolve, reject) => {
        const clearCurrent = () => {
          if (state.currentAudioObj?.audio === audio) {
            state.currentAudioObj = null;
          }
          URL.revokeObjectURL(audioUrl);
        };

        state.currentAudioObj = { audio, audioUrl, resolve, reject };

        audio.onended = () => {
          clearCurrent();
          resolve();
        };
        audio.onerror = () => {
          clearCurrent();
          reject(audio.error ?? new Error('Audio playback failed'));
        };
        audio.play().catch(reject);
      });
    }
  } finally {
    state.isPlaying = false;
  }
} 

function interruptPlayback() {
  state.playbackSession += 1;

  if (state.currentAudioObj) {
    const { audio, audioUrl, resolve } = state.currentAudioObj;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = '';
    URL.revokeObjectURL(audioUrl);
    state.currentAudioObj = null;
    resolve?.();
  }

  state.audioQueue = [];
}

function isAgentSpeaking() {
  return (
    Boolean(state.currentAudioObj) ||
    state.isPlaying ||
    state.audioQueue.length > 0
  );
}

function getMicRms(analyser, samples) {
  analyser.getByteTimeDomainData(samples);

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const normalized = (samples[i] - 128) / 128;
    sum += normalized * normalized;
  }

  return Math.sqrt(sum / samples.length);
}

async function startBargeInMonitor() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.3;
  source.connect(analyser);

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const samples = new Uint8Array(analyser.fftSize);
  let loudFrames = 0;

  function tick() {
    const rms = getMicRms(analyser, samples);

    if (isAgentSpeaking() && rms >= BARGE_IN.rmsThreshold) {
      loudFrames += 1;
      if (loudFrames >= BARGE_IN.consecutiveFrames) {
        console.log('🛑 Barge-in from mic level', rms.toFixed(3));
        interruptPlayback();
        loudFrames = 0;
      }
    } else {
      loudFrames = 0;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
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

    interruptPlayback();

    for await (const chunk of llmStreaming(transcript)) {
      console.log('💬 Agent Response Chunk:', chunk.delta);
      speak(chunk.delta);
    }

  }

  await startBargeInMonitor();
  speechRecognition.start();

}

main();