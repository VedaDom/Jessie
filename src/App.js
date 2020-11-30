import React, { useRef, useState, useEffect  } from 'react';
import './App.scss';

import { Canvas, useFrame } from "react-three-fiber";

import { OrbitControls } from "drei";

import axios from "axios";

import SimplexNoise from "simplex-noise";

import { useSpring, a } from "react-spring/three";

import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';


var noise = new SimplexNoise();

function fractionate(val, minVal, maxVal) {
  return (val - minVal)/(maxVal - minVal);
}

function modulate(val, minVal, maxVal, outMin, outMax) {
  var fr = fractionate(val, minVal, maxVal);
  var delta = outMax - outMin;
  return outMin + (fr * delta);
}

function avg(arr){
  var total = arr.reduce(function(sum, b) { return sum + b; });
  return (total / arr.length);
}

function max(arr){
  return arr.reduce(function(a, b){ return Math.max(a, b); })
}

const wit = async (message) => {
  var config = {
    method: 'get',
    url: `https://api.wit.ai/message?v=20201021&q=${message}`,
    headers: { 
      'Authorization': 'Bearer UQJVPTTDPVX4MQPHBPKZMJBVC3SVG3JV'
    }
  };
  
  const res = await axios(config);
  return res.data;
}

const Sphere = () => {

  const ref = useRef(null);
  const mesh = useRef();

  const [ready, setReady] = useState(false);
  const [dataArray, setDataArray] = useState();
  const [isInCenter, setIsInCenter] = useState(true);
  // const [text, setText] = useState("Hello! is there anyone? If you're, You can call me Jessie. Feel free to call me if you need any help.");
  const [text, setText] = useState("Hello! I'm Jessie. Your personal assistant. To get started, tell me some things about yourself and what can I help you with.");

  const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
  const analyser = useRef(audioContext.current.createAnalyser());

  const props = useSpring({
    position: isInCenter ? [0, 0, 0] : [-30, 0, 0]
  })

  const { transcript, resetTranscript, interimTranscript, listening } = useSpeechRecognition();
  const [isListening, setIsListening] = useState(false);
  const [message, setMessage] = useState('');
  // if (!SpeechRecognition.browserSupportsSpeechRecognition) {
  //   console.log('Not supported!');
  // }

  SpeechRecognition.startListening({ continuous: true });

  const getSpeech = async (text) => {
    const response = await axios.post(
      "https://api.eu-gb.text-to-speech.watson.cloud.ibm.com/instances/490efb2e-9938-42c0-84ee-73f960ad79aa/v1/synthesize?voice=en-GB_CharlotteV3Voice",
      {
        text: text
      }, 
      {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'audio/wav',
        },
        auth: {
          username: 'apikey',
          password: "1tX36zmqF2Km0rLydaGBRD_RPzOrzOQnHvm_oD6QpeJS"
        }
      }
    );
    const source = audioContext.current.createBufferSource();
    audioContext.current.decodeAudioData(response.data).then((audioBuffer) => {
      source.buffer = audioBuffer;
    });
    source.connect(analyser.current);
    analyser.current.connect(audioContext.current.destination);
    analyser.current.fftSize = 2048;
    var bufferLength = analyser.current.frequencyBinCount;
    var dataArray = new Uint8Array(bufferLength);
    setDataArray(dataArray);
    source.start(0);
    setReady(true);
  }

  useFrame(() => {
    if (!isListening) {
      mesh.current.rotation.y += 0.001;
    }
    if (!ready) {
      return;
    }

    analyser.current.getByteFrequencyData(dataArray);
    var lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
    var lowerMax = max(lowerHalfArray);
    var upperAvg = avg(lowerHalfArray);
    var lowerMaxFr = lowerMax / lowerHalfArray.length;
    var upperAvgFr = upperAvg / lowerHalfArray.length;
    const bassFr = modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8);
    const treFr = modulate(upperAvgFr, 0, 1, 0, 4);

    ref.current.vertices.map(vertex => {
      var offset = ref.current.parameters.radius;
      var amp = 7;
      var time = window.performance.now();
      vertex.normalize();
      var rf = 0.00001;
      var distance = (offset + bassFr ) + noise.noise3D(vertex.x + time *rf*7, vertex.y +  time*rf*8, vertex.z + time*rf*9) * amp * treFr;
      vertex.multiplyScalar(distance);
      return vertex;
    });
    ref.current.verticesNeedUpdate = true;
    ref.current.normalsNeedUpdate = true;
    ref.current.computeVertexNormals();
    ref.current.computeFaceNormals();
  });


  useEffect(() => {
    if (interimTranscript.toLowerCase().includes('jessie')) {
      setIsListening(true);
    }
    if (isListening && message.length > 1 && interimTranscript === "") {
      setIsListening(false);
      wit(message).then((data) => {
        if (data.intents[0] === undefined) {
          return getSpeech(`I do not understand what; "${data.text}" mean. Would you like to help me on that?`);
        }
        if (data.traits[`wit_${data.intents[0].name}`] === undefined) {
          getSpeech(`I do not understand what; "${data.text}" mean. Would you like to help me on that?`);
        } else{
          getSpeech(data.traits[`wit_${data.intents[0].name}`][0].value);
        }
      });
      setMessage("");
    }
    if (isListening && !interimTranscript.toLowerCase().includes('jessie') && interimTranscript.length > 1) {
      setMessage(interimTranscript);
    }
  });

  const onClick = (e) => {
    audioContext.current.resume().then(() => {
      console.log('resumed');
    })
  }

  return(
  <a.mesh
    ref={mesh}
    position={props.position}
    onClick={onClick}>
      <icosahedronGeometry
        ref={ref}
        attach="geometry"
        args={[15, 15]}
      />
      <meshLambertMaterial 
        attach="material"
        color={0xff00ee}
        wireframe={true}
      />
  </a.mesh>
  );
}

const App = () => {
  return (
    <>
    <Canvas
      camera={{position: [0, 0, 100], fov: 45}}>
      <ambientLight
        color={0xaaaaaa}
      />
      <pointLight
        castShadow
        color={0xffffff}
        intensity={0.9}
        position={[-10, 40, 20]}
      />

      <Sphere />
      
      <OrbitControls />
    </Canvas>
    </>
  );
}

export default App;
