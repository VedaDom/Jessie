import React, { useRef, useState, useEffect  } from 'react';
import './App.scss';

import { Canvas, useFrame } from "react-three-fiber";

import { OrbitControls } from "drei";

import axios from "axios";

import SimplexNoise from "simplex-noise";

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

function Sphere() {

  const ref = useRef(null);
  const mesh = useRef();

  const [ready, setReady] = useState(false);
  const [dataArray, setDataArray] = useState();
  // const [text, setText] = useState("Hello! is there anyone? If you're, You can call me Jessie. Feel free to call me if you need any help.");
  const [text, setText] = useState("Hello! I'm Jessie. Your personal assistant. To get started, tell me some things about yourself and what can I help you with.");

  const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
  const analyser = useRef(audioContext.current.createAnalyser());  

  useFrame(() => {
    mesh.current.rotation.y += 0.001;
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
    const getSpeech = async () => {
      const response = await axios.post(
        "https://api.eu-gb.text-to-speech.watson.cloud.ibm.com/instances/3c51f216-127f-45fb-85c4-b4ffc8793603/v1/synthesize?voice=en-GB_CharlotteV3Voice",
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
            password: "hiw4yOfvlRDJacJVfgQwqJdBImNgWfC92mm-akoWSdvv"
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
    getSpeech();
  }, [text]);


  return(
  <mesh
    ref={mesh}
    position={[0, 0, 0]}>
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
  </mesh>
  );
}

function App() {
  
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
