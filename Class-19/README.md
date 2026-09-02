# Class-19: Voice and Realtime Agents

This class builds a browser-based **voice agent** from scratch, evolving it phase by phase. We start with a naive "record → think → speak" loop and progressively fix the real problems that make voice agents feel human: interruptions, latency, overlapping audio, and natural barge-in.

Each phase lives in its own file (`Phase1.js` → `Phase5.js`), so you can read the code alongside the explanation and watch the agent get better one step at a time.

## Source Code

The code and the actual voice agent for this class live in this GitHub repo:
[SharmaAtul12/Voice-AI-Agent](https://github.com/SharmaAtul12/Voice-AI-Agent)

## Table of Contents

- [Background: Why Voice Agents Are Hard](#background-why-voice-agents-are-hard)
- [Phase 1 — The Simple Voice Agent](#phase-1--the-simple-voice-agent)
- [Phase 2 — Interruption Management](#phase-2--interruption-management)
- [Phase 3 — Streaming (and Why It Breaks)](#phase-3--streaming-and-why-it-breaks)
- [Phase 4 — The Audio Queue](#phase-4--the-audio-queue)
- [Phase 5 — Sentences, Sessions, and Barge-In](#phase-5--sentences-sessions-and-barge-in)
- [Phase Comparison](#phase-comparison)

---

# Background: Why Voice Agents Are Hard

## Why We Can't Train LLMs Directly on Voice

LLMs (like OpenAI's models and Claude) are fundamentally **text-to-text** models. You feed them text, and they generate text.

So why not just train an LLM directly on voice?

The problem is **serialization**. Text has a clean, fixed representation, every character maps to a stable value (e.g. ASCII), so it is easy to tokenize and learn from. Voice does not. Even when two people say the exact same sentence, the actual voice signal (waveform) is completely different: pitch, tone, accent, speed, and background noise all vary. There is no clean, consistent representation of "voice" the way there is for text.

Because of this, we don't build a true **Voice ⟷ Voice** model. Instead, we work around it by keeping the LLM in the text world and wrapping it with converters.

## The Chained Architecture

The practical solution is the **Chained Architecture**. We chain together three stages so the LLM only ever deals with text:

```
   ┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
   │     STT      │        │   Text to Text   │        │     TTS      │
🎤 │ Speech→Text  │  ───▶  │      LLM         │  ───▶  │ Text→Speech  │ ───▶ 🔊
   │ (user voice) │  text  │ (OpenAI/Claude)  │  text  │ (voice out)  │
   └──────────────┘        └──────────────────┘        └──────────────┘
```

**Step by step:**

1. **STT (Speech To Text):** The user speaks. We first convert that voice into text.
2. **Text to Text (LLM):** That text is sent to the LLM, which generates a text response.
3. **TTS (Text To Speech):** The text response from the LLM is converted back into voice.

This way the LLM stays in its comfort zone (text in, text out), and we bolt STT on the front and TTS on the back to make the whole thing feel like a voice conversation. Every phase below is a refinement of this exact pipeline.

---

# Phase 1 — The Simple Voice Agent

> **File:** `Phase1.js` (originally `simpleAgent.js`) &nbsp;•&nbsp; **Goal:** get the chained architecture working end to end.

`Phase1.js` is the minimal, working implementation of the chained architecture, running entirely in the browser. It has three key functions:

- `main()` handles **STT** using the browser's built-in Web Speech API.
- `llm()` is the **Text to Text** stage, calling OpenAI.
- `speak()` handles **TTS**, turning the reply back into audio.

## Flow Diagram

```
User speaks
     │
     ▼
[ SpeechRecognition ]  (STT, browser Web Speech API)
     │  transcript
     ▼
[ llm(transcript) ]    → POST /v1/responses (gpt-4o-mini)
     │  text response
     ▼
[ speak(response) ]    → POST /v1/audio/speech (gpt-4o-mini-tts)
     │  audio Blob
     ▼
🔊 audio.play()
```

## 1.1 STT — Capturing the User's Voice (`main`)

The speech recognition uses the browser's native `SpeechRecognition` API, so no extra STT model is needed for this simple version.

```js
const SpeechRecognition = window.SpeechRecognition;
const speechRecognition = new SpeechRecognition();

speechRecognition.continuous = true;      // keep listening, don't stop after one result
speechRecognition.interimResults = false; // only give the final result, not word-by-word
speechRecognition.maxAlternatives = 1;    // just the single best match, no alternatives
```

Three config options define its behavior:

- **`continuous = true`** — recognition keeps listening for more speech instead of stopping after a single result. It only stops when manually told to.
- **`interimResults = false`** — we only want the final transcript after the user finishes speaking, not partial word-by-word results.
- **`maxAlternatives = 1`** — return only the single best-matching transcription, not a list of possible interpretations.

When a result comes in, the `onresult` handler grabs the latest transcript and pushes it through the rest of the chain:

```js
speechRecognition.onresult = async function (event) {
  const transcript = event.results[event.results.length - 1][0].transcript;
  const textResponse = await llm(transcript);  // -> Text to Text
  await speak(textResponse);                    // -> Text to Speech
};

speechRecognition.start();
```

## 1.2 Text to Text — The LLM (`llm`)

The transcript is sent to OpenAI's `/v1/responses` endpoint using the `gpt-4o-mini` model. The response has a nested structure, so we dig out the actual text:

```js
const textOutput = data.output
  .flatMap((item) => item.content ?? [])
  .find((content) => content.type === 'output_text');
return textOutput ? textOutput.text : '';
```

`flatMap` flattens all `content` arrays from the output items, and `find` picks out the entry whose `type` is `output_text`, which holds the actual reply string.

## 1.3 TTS — Speaking the Response (`speak`)

The LLM's text reply is sent to OpenAI's `/v1/audio/speech` endpoint using the `gpt-4o-mini-tts` model. Notable parameters:

- **`voice: 'alloy'`** — the voice preset used for the output.
- **`instructions`** — steers the delivery style (here: cheerful, warm, natural tone).

The API returns the audio as a **Blob** (a binary audio file). We turn that Blob into a playable URL and play it in the browser:

```js
const audioBlob = await response.blob();
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
audio.onended = () => URL.revokeObjectURL(audioUrl); // free the URL after playback
```

`URL.createObjectURL` creates a temporary in-memory URL pointing at the audio Blob so the `<audio>` element can play it. Once playback ends, `revokeObjectURL` releases that memory.

## 1.4 What's Wrong With Phase 1

It works, but it's rigid: it waits for the full response, then the full audio, then plays it, and it has no idea what to do if the user talks over it. The next phases fix these one by one.

> **Security note:** The `API_KEY` must never be exposed in client-side/browser code, it should sit behind a backend. Hardcoding it in these files is fine for a local learning demo only.

---

# Phase 2 — Interruption Management

> **File:** `Phase2.js` &nbsp;•&nbsp; **Goal:** stop the agent's audio the moment the user starts a new turn.

## 2.1 The Problem

Because recognition is `continuous`, the mic keeps listening even while the agent is talking. So if the user speaks in the middle of the agent's response, two bad things happen:

1. The new speech is picked up, sent to the LLM, and generates a **second** response.
2. The **previous** audio may still be playing when the new audio starts, so both play **at the same time**, talking over each other.

In a real conversation, if you start talking, the other person stops and listens. Phase 1 doesn't do that. We need to detect a new user turn and **cut off the currently playing audio** before starting the next one.

## Flow Diagram

```
Agent is speaking 🔊
     │
     ▼
User starts talking  ──▶  onresult fires (new transcript)
     │
     ▼
Is audio still playing?  ──yes──▶  pause + revoke + clear currentAudioObj   (INTERRUPT)
     │
     ▼
[ llm(new transcript) ] ──▶ [ speak(response) ] ──▶ 🔊 (plays cleanly, no overlap)
```

## 2.2 The Fix: Track the Currently Playing Audio

`Phase2.js` keeps a reference to whatever audio is currently playing, so it can be stopped on demand. A small `state` object holds it:

```js
let state = {
  currentAudioObj: null
}
```

Inside `speak()`, when audio starts playing, we store both the audio element and its object URL in state. When playback finishes naturally, we clear it:

```js
const audio = new Audio(audioUrl);
state.currentAudioObj = { audioUrl, audio };

audio.play();
audio.onended = () => {
  state.currentAudioObj = null;
  URL.revokeObjectURL(audioUrl); // clean up after natural completion
};
```

## 2.3 Interrupting on a New User Turn

The key change is in `onresult`. The moment a new transcript arrives, we stop any playing audio **before** doing anything else:

```js
speechRecognition.onresult = async function (event) {
  const transcript = event.results[event.results.length - 1][0].transcript;

  // Interruption management: kill any audio that's still playing
  if (state.currentAudioObj) {
    state.currentAudioObj.audio.pause();
    URL.revokeObjectURL(state.currentAudioObj.audioUrl);
    state.currentAudioObj = null;
  }

  const textResponse = await llm(transcript);
  await speak(textResponse);
};
```

This does three things on interrupt:

- **`audio.pause()`** — stops the currently playing response so it no longer talks over the user.
- **`URL.revokeObjectURL(...)`** — frees the memory held by the old audio's object URL.
- **`state.currentAudioObj = null`** — clears the reference so state stays accurate.

## 2.4 What's Wrong With Phase 2

Turn-taking works now, but the agent feels **slow**. It waits for the entire text response, then the entire audio file, before making a sound. That latency is the next target.

---

# Phase 3 — Streaming (and Why It Breaks)

> **File:** `Phase3.js` &nbsp;•&nbsp; **Goal:** cut latency by streaming text and speaking it as it arrives. (This phase intentionally breaks, it sets up the need for a queue.)

## 3.1 The Latency Problem

Phase 2 is correct but blocking. The chain runs strictly one step at a time:

1. Wait for the **entire** LLM text response to finish generating.
2. **Then** send that whole text to TTS.
3. **Then** wait for the whole audio file to come back.
4. **Then** play it.

The user sits in silence the whole time. For a long answer, that pause before the agent even starts talking is painful.

## 3.2 The Idea: Stream the Text

Instead of waiting for the full response, **stream** the text from the LLM token by token and convert each piece to audio as it arrives, so the agent can start talking almost immediately.

`Phase3.js` adds a streaming LLM function, `llmStreaming`, an async generator that reads the response body as a stream:

```js
async function* llmStreaming(userText = '') {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', input: userText, stream: true }),
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
    buffer = events.pop() ?? '';   // keep the last, possibly-incomplete event in the buffer

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
        yield { textContent, isFinal: false, delta: parsed.delta }; // emit each new piece
      }
    }
  }
  yield { textContent, isFinal: true, delta: '' };
}
```

**How the streaming parse works:**

- OpenAI sends **Server-Sent Events (SSE)**, chunks of text where events are separated by a blank line (`\n\n`) and each data line is prefixed with `data: `.
- Network chunks don't line up neatly with event boundaries, so we accumulate into a `buffer`, split on `\n\n`, and keep the last (possibly incomplete) piece back in the buffer for next time.
- For each `response.output_text.delta` event, we `yield` the new `delta` (the newly generated piece of text).

Then `onresult` consumes the stream and speaks each delta as it comes:

```js
for await (const chunk of llmStreaming(transcript)) {
  speak(chunk.delta);   // fire TTS for every delta (NO await!)
}
```

## Flow Diagram

```
User transcript
     │
     ▼
[ llmStreaming ]  ── delta ──▶ speak(delta)  ─┐
     │             ── delta ──▶ speak(delta)  ─┤  all fire at once,
     │             ── delta ──▶ speak(delta)  ─┤  none awaited
     │             ── delta ──▶ speak(delta)  ─┘
     ▼                                 │
   (fast text)                         ▼
                          🔊🔊🔊🔊  ALL PLAY AT ONCE  ❌ garbled/overlapping
```

## 3.3 Why This Works Very Badly

This version streams, but the audio comes out **garbled and overlapping**:

- The loop calls `speak(chunk.delta)` for **every single delta**, and does **not** `await` it. So a new TTS request fires for each tiny fragment, all at once, without waiting for the previous audio to finish.
- Each `speak()` call races the others: they all fetch audio and call `audio.play()` at roughly the same time, so **many clips play simultaneously**, mixed together.
- Each `speak()` call also overwrites `state.currentAudioObj`, so only the last one is tracked. Earlier clips keep playing but become untracked and unstoppable, which also breaks Phase 2's interruption logic.
- The deltas are **tiny** (often a word or sub-word), so even without overlap the audio would be choppy and unnatural.

**Root issue:** streaming gave us text fast, but there's **no ordering or serialization** on the audio side. Text generation is fast and concurrency-friendly; audio playback is inherently **sequential**, one clip must finish before the next starts.

## 3.4 What We Need Next

A **queue**: buffer text into sensible chunks, push audio jobs into a queue, and play them one at a time, in order. That's Phase 4.

---

# Phase 4 — The Audio Queue

> **File:** `Phase4.js` &nbsp;•&nbsp; **Goal:** play streamed audio clips in order, one at a time, never overlapping.

Phase 4 fixes the **ordering** problem with a **queue**. We push each audio clip into a queue, and a single drain loop grabs them one by one and plays them sequentially, never starting the next until the current one finishes.

## Flow Diagram

```
[ llmStreaming ] ── delta ──▶ speak(delta) ──▶ fetch audio ──▶ push to audioQueue
                  ── delta ──▶ speak(delta) ──▶ fetch audio ──▶ push to audioQueue
                  ── delta ──▶ speak(delta) ──▶ fetch audio ──▶ push to audioQueue

           audioQueue: [ clip1, clip2, clip3, ... ]
                              │
              (only the first speak() runs the drain loop; guarded by isPlaying)
                              ▼
        ┌──────────────── drain loop ─────────────────┐
        │  shift clip ▶ play ▶ await onended ▶ repeat  │  ──▶ 🔊 clip1 ▶ clip2 ▶ clip3  ✅ in order
        └──────────────────────────────────────────────┘
```

## 4.1 The Queue State

The `state` object grows to hold the queue and a playing flag:

```js
let state = {
  currentAudioObj: null,
  audioQueue: [],   // holds audio blobs waiting to be played
  isPlaying: false, // true while the queue is being drained
}
```

## 4.2 Push, Then Drain One at a Time

`speak()` no longer plays immediately. It fetches the audio blob, **pushes it into `audioQueue`**, then drains the queue in order. The key is `await`-ing a Promise that only resolves when the current clip's `onended` fires, so the next clip can't start early:

```js
const audioBlob = await response.blob();
state.audioQueue.push(audioBlob);      // enqueue

if (state.isPlaying) return;           // a drain loop is already running, don't start a second one

state.isPlaying = true;
try {
  while (state.audioQueue.length > 0) {
    const queuedBlob = state.audioQueue.shift();   // take the next in line
    const audioUrl = URL.createObjectURL(queuedBlob);
    const audio = new Audio(audioUrl);

    await new Promise((resolve, reject) => {       // wait for THIS clip to finish
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();                                 // only now does the loop continue
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(audio.error ?? new Error('Audio playback error'));
      };
      audio.play().catch(reject);
    });
  }
} finally {
  state.isPlaying = false;
}
```

- **`push`** adds the new clip to the back of the queue.
- **`if (state.isPlaying) return;`** is the crucial guard. Since `speak()` is called many times in quick succession (once per streamed chunk), without it each call would start its own drain loop and clips would overlap again. This ensures only the **first** call runs the loop; later calls just enqueue their blob and return, trusting the running loop to pick it up.
- **`shift`** pulls the next clip from the front (FIFO order).
- **`await new Promise(...)`** blocks the loop until `onended` resolves it, guaranteeing clips play **sequentially** instead of overlapping.

Now audio no longer mixes, clips play in the right order, one after another.

## 4.3 What's Wrong With Phase 4

We're still calling `speak(chunk.delta)` for **every tiny delta**, so each fragment becomes its own clip. They now play in order, but they're broken at the wrong places:

```
"hello" ...... (wait) "how" ...... (wait) "are" ...... (wait) "you"
```

The speech has awkward gaps between fragments because each sub-word is fetched and spoken separately. It's ordered, but it doesn't sound like natural sentences. Phase 5 fixes this.

---

# Phase 5 — Sentences, Sessions, and Barge-In

> **File:** `Phase5.js` &nbsp;•&nbsp; **Goal:** speak whole sentences, make interruption bulletproof, and cut in the instant the user starts talking.

Phase 5 is the biggest jump. It does three things: **buffers text into whole sentences**, **rebuilds interruption around a session counter**, and adds **barge-in** by listening to the microphone's energy level directly.

## Flow Diagram

```
                        ┌──────────────────────────────────────────────┐
🎤 mic energy monitor ──│ RMS ≥ threshold for N frames while speaking?  │
   (runs continuously)  │        └─ yes ─▶ interruptPlayback()           │  ◀── BARGE-IN
                        └──────────────────────────────────────────────┘
                                          │ (bumps playbackSession, clears queue + current audio)
User transcript                           │
     │                                     │
     ▼                                     │
[ llmStreaming ] ── buffers deltas ──▶ yields WHOLE SENTENCES
     │  "Hello, how are you?"   "I can help with that."
     ▼
speak(sentence) ──▶ fetch ──▶ push to audioQueue ──▶ drain loop (session-checked)
     │                                                      │
     ▼                                                      ▼
   (each call stamped with playbackSession)          🔊 sentence ▶ sentence ✅
```

## 5.1 Buffer Until a Sentence Ends

A sentence usually ends with `.`, `?`, or `!`. So instead of yielding every delta, `llmStreaming` **accumulates deltas into a `sentenceBuffer`** and only yields when a complete sentence is detected.

A helper, `takeSentences`, scans the buffer for sentence-ending punctuation, slices out every complete sentence, and returns the remaining incomplete tail:

```js
function takeSentences(text) {
  const sentences = [];
  let rest = text;

  while (true) {
    const end = rest.search(/[.?]/);   // find the next sentence end
    if (end === -1) break;             // no complete sentence left
    const sentence = rest.slice(0, end + 1).trim();
    rest = rest.slice(end + 1);        // keep what's after it
    if (sentence) sentences.push(sentence);
  }

  return { sentences, rest };
}
```

On each delta, we append to the buffer, pull out any complete sentences, keep the leftover tail, and yield each finished sentence:

```js
sentenceBuffer += parsed.delta;
const { sentences, rest } = takeSentences(sentenceBuffer);
sentenceBuffer = rest;                 // incomplete tail waits for more deltas
for (const sentence of sentences) {
  yield { textContent, isFinal: false, delta: sentence };
}
```

When the stream ends, any leftover text in the buffer is flushed as a final sentence:

```js
const leftover = sentenceBuffer.trim();
if (leftover) yield { textContent, isFinal: true, delta: leftover };
```

Now TTS receives full sentences like `"Hello, how are you?"` instead of `"hello" ... "how" ... "are"`, which sounds natural.

## 5.2 A TTS-Friendly System Prompt

To make the sentence-boundary approach reliable, we also steer the model itself. Instead of sending the raw user text, the input wraps it in a system instruction:

> You are a part of a Speech To Text and Text To Speech pipeline. Always make sure, while streaming, to answer in sentences so that it is easier to convert them to speech as soon as a sentence completes.

```js
input: `You are a part of Speech To Text and Text To Speech Pipeline.
Always make sure while streaming to answer in sentences so that it's easier for me to convert them to Speech as soon as sentence completes.
User Query:
${userText}
`,
```

This nudges the model to produce clean, well-punctuated sentences, so the buffer-flush-on-punctuation logic works predictably.

## 5.3 Session-Based Interruption

Since audio now lives in a queue, stopping playback isn't just about the one `currentAudioObj` anymore. Phase 5 introduces a **playback session** counter to invalidate everything from a previous turn in one shot:

```js
let state = {
  currentAudioObj: null,
  audioQueue: [],
  isPlaying: false,
  playbackSession: 0,   // increments on every interruption
}
```

`interruptPlayback()` is the single entry point for stopping the agent:

```js
function interruptPlayback() {
  state.playbackSession += 1;          // invalidate the old session

  if (state.currentAudioObj) {
    const { audio, audioUrl, resolve } = state.currentAudioObj;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();                     // stop the clip that's playing now
    audio.src = '';
    URL.revokeObjectURL(audioUrl);
    state.currentAudioObj = null;
    resolve?.();                       // unblock the awaiting drain loop
  }

  state.audioQueue = [];               // drop everything still queued
}
```

Two things make this robust:

- **Bumping `playbackSession`** stamps every `speak()` call with the session it belongs to (`const session = state.playbackSession;` at the top of `speak`). The drain loop checks `session === state.playbackSession` on each iteration, and there's an early `if (session !== state.playbackSession) return;`. So any audio still being fetched or queued from the interrupted turn is silently discarded, no stale sentences from a previous turn sneak into playback.
- **Clearing the queue and the current object** stops both what's playing now and everything waiting, so the agent goes quiet immediately.

## 5.4 Interrupting the Instant the User Speaks (Barge-In)

Here's the big shift. In Phases 2–4, interruption only happened inside `onresult`, meaning we waited for **STT to finish transcribing** a full utterance before cutting off the agent. That's late, the user has to finish a sentence before the agent stops.

Phase 5 interrupts the moment the user **starts** to speak, by listening to the **raw energy level of the microphone** directly, independent of STT. This is called **barge-in**.

### Step 1 — Measure mic loudness (RMS)

`getMicRms` reads the raw waveform samples and computes the **RMS (root mean square)**, a measure of how loud the current audio frame is:

```js
function getMicRms(analyser, samples) {
  analyser.getByteTimeDomainData(samples);   // raw waveform, 0-255 per sample

  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const normalized = (samples[i] - 128) / 128;  // center to -1..1
    sum += normalized * normalized;                // square each sample
  }
  return Math.sqrt(sum / samples.length);          // sqrt of the mean = RMS
}
```

- Each raw sample is `0–255`, with `128` being silence (the center line). Subtracting 128 and dividing by 128 normalizes it to a `-1..1` range.
- Squaring, averaging, and taking the square root gives the RMS, essentially the energy/volume of that frame. Silence is near `0`; talking pushes it up.

### Step 2 — Set up a live mic monitor

`startBargeInMonitor` opens the microphone and wires it into the Web Audio API's `AnalyserNode`, which exposes live waveform data:

```js
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});
const audioContext = new AudioContext();
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 0.3;
source.connect(analyser);
```

- **`echoCancellation`** is important: it stops the agent's *own* voice (coming out of the speakers) from being picked up by the mic and mistaken for the user talking.
- **`fftSize = 2048`** sets how many samples make up each analysis frame.

### Step 3 — Watch for sustained loudness

A `tick` loop runs every animation frame, computing RMS and checking it against a threshold, but only while the agent is actually speaking:

```js
const BARGE_IN = { rmsThreshold: 0.1, consecutiveFrames: 5 };

function tick() {
  const rms = getMicRms(analyser, samples);

  if (isAgentSpeaking() && rms >= BARGE_IN.rmsThreshold) {
    loudFrames += 1;
    if (loudFrames >= BARGE_IN.consecutiveFrames) {   // sustained, not a blip
      interruptPlayback();
      loudFrames = 0;
    }
  } else {
    loudFrames = 0;   // reset on any quiet frame
  }
  requestAnimationFrame(tick);
}
```

- **`rmsThreshold: 0.1`** is the loudness level that counts as "the user is speaking." Below it is treated as silence/background noise.
- **`consecutiveFrames: 5`** requires the loudness to persist across several frames before triggering. This filters out momentary spikes (a cough, a click, a door slam) so the agent isn't interrupted by random noise. A single quiet frame resets the counter.
- **`isAgentSpeaking()`** guards the whole thing, we only barge in when there's actually audio playing or queued:

```js
function isAgentSpeaking() {
  return Boolean(state.currentAudioObj) || state.isPlaying || state.audioQueue.length > 0;
}
```

**The result:** as soon as the user speaks over the agent, the mic energy crosses the threshold for a few frames, `interruptPlayback()` fires, and the agent stops instantly, without waiting for STT to produce a transcript. This feels like a real conversation where you can just cut in. `onresult` still calls `interruptPlayback()` too, as a backstop for when the full transcript arrives.

---

# Phase Comparison

| Phase | File | What it adds | Problem it leaves behind |
|-------|------|--------------|--------------------------|
| **1** | `Phase1.js` | Basic STT → LLM → TTS chained loop | No interruption; user is talked over |
| **2** | `Phase2.js` | Interruption: stop current audio on new turn | High latency, agent waits for full text + full audio |
| **3** | `Phase3.js` | Streaming text, speak each delta | Audio overlaps and is garbled (no ordering) |
| **4** | `Phase4.js` | Audio queue, sequential playback | Choppy: each tiny delta is its own clip |
| **5** | `Phase5.js` | Sentence buffering, session-based interruption, mic-level barge-in | — (natural, low-latency, interruptible) |

Each phase is a targeted fix for the exact weakness of the one before it, ending with a voice agent that streams sentences with low latency, plays them cleanly in order, and lets the user cut in naturally.
