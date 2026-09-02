const API_KEY = "";

let state = {
  currentAudioObj: null
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
  state.currentPlaying = true;
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
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  state.currentAudioObj = {
    audioUrl,
    audio
  }

  audio.play();
  audio.onended = () => {
    state.currentAudioObj = null;
    URL.revokeObjectURL(audioUrl); // Clean up the object URL after playback
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

    const textResponse = await llm(transcript);
    console.log('💬 Agent Response:', textResponse);

    //! 2. Text to Speech
    await speak(textResponse);
  }

  speechRecognition.start();

}

main();