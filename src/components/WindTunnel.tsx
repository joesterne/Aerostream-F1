import React, { useRef, useEffect, useState, MouseEvent as ReactMouseEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Maximize, Minimize } from 'lucide-react';
import { buildCarGroup } from '../lib/three/CarBuilder';
import { AeroSetup, TelemetryData } from '../types';
import { cn } from '../lib/utils';

interface WindTunnelProps {
  setup: AeroSetup;
  isSimulating: boolean;
  onTelemetryUpdate: (data: Partial<TelemetryData>) => void;
  latestTelemetry?: TelemetryData;
  ersMode?: 'neutral' | 'regen' | 'boost';
  carModel?: 'Formula 1' | 'Hypercar' | 'GT3';
  drsActive?: boolean;
}

export const WindTunnel: React.FC<WindTunnelProps> = ({ setup, isSimulating, onTelemetryUpdate, latestTelemetry, ersMode = 'neutral', carModel = 'Formula 1', drsActive = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cloudRef = useRef<THREE.Points | null>(null);
  const rwTopMeshRef = useRef<THREE.Mesh | null>(null);
  const drsLightRef = useRef<THREE.PointLight | null>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);
  const fanBladeRef = useRef<THREE.Group | null>(null);
  const beltMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const latestTelemetryRef = useRef(latestTelemetry);
  const ersModeRef = useRef(ersMode);
  const drsActiveRef = useRef(drsActive);
  const speedFactorRef = useRef(isSimulating ? 1 : 0);
  const setupRef = useRef(setup);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  const [view, setView] = useState<'ISO' | 'ORTHO' | 'FRONT'>('ISO');
  const viewRef = useRef(view);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windYaw, setWindYaw] = useState<number>(0);
  const windYawRef = useRef(windYaw);

  useEffect(() => {
    windYawRef.current = windYaw;
  }, [windYaw]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    viewRef.current = view;
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    if (view === 'ISO') {
      camera.position.set(7, 3.5, 7);
    } else if (view === 'ORTHO') {
      // Small offset to prevent lookAt gimbal lock
      camera.position.set(0.01, 10, 0);
    } else if (view === 'FRONT') {
      camera.position.set(9, 1.5, 0);
    }
    controlsRef.current.target.set(0, 0.5, 0);
    controlsRef.current.update();
  }, [view]);

  useEffect(() => {
    latestTelemetryRef.current = latestTelemetry;
  }, [latestTelemetry]);

  useEffect(() => {
    ersModeRef.current = ersMode;
  }, [ersMode]);

  useEffect(() => {
    drsActiveRef.current = drsActive;
  }, [drsActive]);

  // Dragging state for Tyre Status HUD
  const [hudPos, setHudPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialHudX: 0, initialHudY: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialHudX: hudPos.x,
      initialHudY: hudPos.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setHudPos({
      x: dragStartRef.current.initialHudX + dx,
      y: dragStartRef.current.initialHudY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene & Camera Init
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.FogExp2(0x030712, 0.045);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    if (viewRef.current === 'ISO') {
      camera.position.set(7, 3.5, 7);
    } else if (viewRef.current === 'ORTHO') {
      camera.position.set(0.01, 10, 0);
    } else if (viewRef.current === 'FRONT') {
      camera.position.set(9, 1.5, 0);
    }
    camera.lookAt(0, 0.5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnvironment).texture;
    roomEnvironment.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow a bit below ground
    controls.minDistance = 3;
    controls.maxDistance = 25;
    controls.target.set(0, 0.5, 0);

    // 2. Advanced Lighting
    const ambientLight = new THREE.HemisphereLight(0xdbeafe, 0x020617, 0.85);
    scene.add(ambientLight);

    const mainLight = new THREE.SpotLight(0xffffff, 420, 70, Math.PI / 5, 0.55, 1);
    mainLight.position.set(5, 9, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.lookAt(0, 0, 0);
    scene.add(mainLight);

    const rimLight = new THREE.SpotLight(0x60a5fa, 260, 55, Math.PI / 4, 0.7, 1);
    rimLight.position.set(-8, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0x10b981, 55, 12, 1.8);
    accentLight.position.set(2.4, 1.4, -2.2);
    scene.add(accentLight);

    // 3. Grid & Environment
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x050816, roughness: 0.28, metalness: 0.72, envMapIntensity: 0.8 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.05;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const grid = new THREE.GridHelper(24, 48, 0x2563eb, 0x1e293b);
    grid.position.y = -0.035;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.22;
    scene.add(grid);

    // Wind Tunnel Room / Walls
    const roomGeo = new THREE.CylinderGeometry(14, 14, 100, 32, 1, true);
    const roomMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f172a, 
      roughness: 0.62, 
      metalness: 0.36, 
      side: THREE.BackSide,
      envMapIntensity: 0.45
    });
    const roomMesh = new THREE.Mesh(roomGeo, roomMat);
    roomMesh.rotation.z = Math.PI / 2;
    roomMesh.position.y = 4;
    scene.add(roomMesh);

    // Tunnel Ceiling Strip Lights
    const stripGeo = new THREE.PlaneGeometry(100, 0.4);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xbfdcff, side: THREE.DoubleSide, toneMapped: false });
    for (let i = -1; i <= 1; i += 2) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(0, 17.5, i * 4); // Y=17.5 (close to top of cylinder at 18)
      strip.rotation.x = Math.PI / 2;
      scene.add(strip);
    }

    // Rolling road belt
    const beltCanvas = document.createElement('canvas');
    beltCanvas.width = 512;
    beltCanvas.height = 512;
    const beltCtx = beltCanvas.getContext('2d');
    if (beltCtx) {
      beltCtx.fillStyle = '#111';
      beltCtx.fillRect(0, 0, 512, 512);
      beltCtx.fillStyle = '#333';
      for (let i = 0; i < 8; i++) {
        // Since belt is a plane that has Width along X (12) and Height along Y (3),
        // Wait, PlaneGeometry(12, 3) rotated -Math.PI/2 rotates the Y axis to Z.
        // So the "X" of the texture maps to the X axis (length of the belt), and "Y" to Z axis (width of belt).
        // So we want vertical lines in the texture to traverse across the belt.
        beltCtx.fillRect(i * 64, 0, 4, 512); 
      }
    }
    const beltTex = new THREE.CanvasTexture(beltCanvas);
    beltTex.wrapS = THREE.RepeatWrapping;
    beltTex.wrapT = THREE.RepeatWrapping;

    const beltGeo = new THREE.PlaneGeometry(12, 3);
    const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.55, metalness: 0.25, color: 0x64748b });
    beltMatRef.current = beltMat;
    const beltMesh = new THREE.Mesh(beltGeo, beltMat);
    beltMesh.rotation.x = -Math.PI / 2;
    beltMesh.position.y = 0;
    scene.add(beltMesh);

    // Wind Tunnel Fan at the rear (X = -12)
    const fanGroup = new THREE.Group();
    fanGroup.position.set(-10, 2.5, 0);
    fanGroup.rotation.y = Math.PI / 2;
    const fanCasing = new THREE.Mesh(
      new THREE.TorusGeometry(3.5, 0.5, 24, 96),
      new THREE.MeshPhysicalMaterial({ color: 0x111827, roughness: 0.32, metalness: 0.85, clearcoat: 0.45 })
    );
    fanGroup.add(fanCasing);
    
    const bladeGeo = new THREE.BoxGeometry(0.05, 6.8, 0.8);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.9 });
    const bladeGroup = new THREE.Group();
    
    // Add central hub to the fan
    const hubGeo = new THREE.ConeGeometry(1.2, 1.5, 32);
    hubGeo.rotateX(-Math.PI / 2); // Pointing forward (towards positive Z natively, but fanGroup is rotated so it points down the tunnel)
    const hub = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.3 }));
    hub.position.z = 0.5;
    bladeGroup.add(hub);

    const numBlades = 11;
    for (let i = 0; i < numBlades; i++) {
       const bladeGeo = new THREE.BoxGeometry(0.1, 3.4, 0.8);
       bladeGeo.translate(0, 1.7, 0); // Shift origin so blade radiates from the center
       const blade = new THREE.Mesh(bladeGeo, bladeMat);
       blade.rotation.z = (i * Math.PI * 2) / numBlades;
       blade.rotation.y = 0.5; // pitch
       bladeGroup.add(blade);
    }
    fanGroup.add(bladeGroup);
    fanBladeRef.current = bladeGroup;
    scene.add(fanGroup);

    // 4. Detailed Car Construction
    const matCarbon = new THREE.MeshPhysicalMaterial({ 
      color: 0x08090c, 
      roughness: 0.34, 
      metalness: 0.78,
      clearcoat: 0.55,
      clearcoatRoughness: 0.28,
      envMapIntensity: 1.2
    });
    const matPaint = new THREE.MeshPhysicalMaterial({ 
      color: 0x172554, // deep professional motorsport blue 
      metalness: 0.48, 
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.35
    });
    const matYellow = new THREE.MeshPhysicalMaterial({ color: 0xfacc15, roughness: 0.22, metalness: 0.28, clearcoat: 0.8 });
    const matRed = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, roughness: 0.2, metalness: 0.32, clearcoat: 0.85 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.4 });

    const builderResult = buildCarGroup(carModel, setupRef.current, matCarbon, matPaint, matYellow, matRed, matAccent);
    const carGroup = builderResult.carGroup;
    const fwGroup = builderResult.fwGroup;
    const rwGroup = builderResult.rwGroup;
    const wheels = builderResult.wheels;
    const rwTopMesh = builderResult.rwTopMesh;
    const drsLight = builderResult.drsLight;
    if (rwTopMesh) rwTopMeshRef.current = rwTopMesh;
    if (drsLight) drsLightRef.current = drsLight;

    carGroup.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Initial Car placement
    wheelsRef.current = wheels;
    const rhOffset = (setup.rideHeight - 50) / 100;
    carGroup.position.y = rhOffset;
    scene.add(carGroup);
    
    // --- Water Spray System (For Wet/Intermediate Tires) ---
    const isWet = setup.tireType === 'Wet' || setup.tireType === 'Intermediate';
    const sprayParticles = new THREE.Points(); // placeholder
    let sprayPos: Float32Array;
    let sprayVel: Float32Array;
    let sprayLife: Float32Array;
    const sprayCount = setup.tireType === 'Wet' ? 2000 : (setup.tireType === 'Intermediate' ? 800 : 0);
    
    if (sprayCount > 0) {
      sprayPos = new Float32Array(sprayCount * 3);
      sprayVel = new Float32Array(sprayCount * 3);
      sprayLife = new Float32Array(sprayCount);
      const sprayColor = new Float32Array(sprayCount * 3);
      
      const sCanvas = document.createElement('canvas');
      sCanvas.width = 16;
      sCanvas.height = 16;
      const sCtx = sCanvas.getContext('2d');
      if (sCtx) {
        const grad = sCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, 'rgba(200, 220, 255, 0.6)');
        grad.addColorStop(1, 'rgba(200, 220, 255, 0)');
        sCtx.fillStyle = grad;
        sCtx.fillRect(0, 0, 16, 16);
      }
      const sprayTex = new THREE.CanvasTexture(sCanvas);
      
      for(let i=0; i<sprayCount; i++) {
        // distribute to 4 wheels
        const wheelIdx = i % 4;
        const wPos = wheels[wheelIdx] ? wheels[wheelIdx].position.toArray() : [0,0,0];
        // behind tire
        sprayPos[i * 3] = wPos[0] - 0.4 - Math.random() * 2.0; 
        sprayPos[i * 3 + 1] = 0.1 + Math.random() * 0.5;
        sprayPos[i * 3 + 2] = wPos[2] + (Math.random() - 0.5) * 0.6;
        
        sprayVel[i * 3] = -0.1 - Math.random() * 0.2;
        sprayVel[i * 3 + 1] = 0.05 + Math.random() * 0.15;
        sprayVel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
        
        sprayLife[i] = Math.random(); 
        
        sprayColor[i*3] = 0.7;
        sprayColor[i*3+1] = 0.8;
        sprayColor[i*3+2] = 1.0;
      }
      
      const sprayGeo = new THREE.BufferGeometry();
      sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
      sprayGeo.setAttribute('color', new THREE.BufferAttribute(sprayColor, 3));
      sprayGeo.setAttribute('life', new THREE.BufferAttribute(sprayLife, 1));
      
      const sprayMat = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        transparent: true,
        opacity: setup.tireType === 'Wet' ? 0.4 : 0.2,
        map: sprayTex,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
      });
      
      sprayParticles.geometry = sprayGeo;
      sprayParticles.material = sprayMat;
      scene.add(sprayParticles);
    }
    // --- End Water Spray System ---

    // 5. Flow Visualization System
    const particleCount = 4000;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount);

    // Create a soft circle texture for particles
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 16, 16);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const numStreamsY = 8;
    const numStreamsZ = 35; 

    function resetParticle(i: number, posArr: Float32Array, velArr: Float32Array, initialStagger: boolean = false) {
      const streamIdx = i % (numStreamsY * numStreamsZ);
      const sy = Math.floor(streamIdx / numStreamsZ);
      const sz = streamIdx % numStreamsZ;
      
      const startX = initialStagger ? 8 + Math.random() * 12 : 8;
      
      const yawAngle = windYawRef.current * (Math.PI / 180);
      const offsetZ = Math.tan(yawAngle) * 8; // Adjust starting Z based on wind direction to ensure it hits the car
      
      posArr[i * 3] = startX;
      posArr[i * 3 + 1] = 0.2 + sy * 0.25; // Y
      posArr[i * 3 + 2] = -3.5 + sz * 0.2 + offsetZ; // Z
      velArr[i] = 0.15 + (sy * 0.005) + Math.random() * 0.02;
    }

    for (let i = 0; i < particleCount; i++) {
      resetParticle(i, pPositions, pVelocities, true);
      pColors[i * 3] = 0.5;
      pColors[i * 3 + 1] = 0.5;
      pColors[i * 3 + 2] = 1.0;
    }

    const pGeometry = new THREE.BufferGeometry();
    pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeometry.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      map: particleTexture,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(pGeometry, pMaterial);
    particles.frustumCulled = false;
    scene.add(particles);
    cloudRef.current = particles;

    // 6. Animation Loop
    let frameId: number;
    let lastUpdate = 0;
    const animate = (time: number = 0) => {
      frameId = requestAnimationFrame(animate);

      controls.update();

      // Smooth speed up / down
      if (isSimulating) {
        speedFactorRef.current += (1 - speedFactorRef.current) * 0.05;
      } else {
        speedFactorRef.current += (0 - speedFactorRef.current) * 0.02;
      }
      
      const currentSpeedFactor = Math.max(0, speedFactorRef.current);

      // Animate wheels and fan (always, based on speedFactor)
      if (fanBladeRef.current) {
        // Add a base idle rotation if desired, but 0 when fully stopped is fine.
        fanBladeRef.current.rotation.z -= currentSpeedFactor * 1.5; 
      }
      wheelsRef.current.forEach(w => w.rotation.z -= currentSpeedFactor * 1.2);
      if (beltMatRef.current && beltMatRef.current.map) {
        beltMatRef.current.map.offset.x -= currentSpeedFactor * 0.15;
      }

      if (isSimulating) {
        const pos = pGeometry.attributes.position.array as Float32Array;
        const col = pGeometry.attributes.color.array as Float32Array;
        const speedBase = 280;
        
        // Dynamic Aerodynamic Instability Calculation
        const fwa = setupRef.current.frontWingAngle || 12;
        const rwa = setupRef.current.rearWingAngle || 18;
        const rh = setupRef.current.rideHeight || 35;

        const currentFwRestRotZ = -fwa * (Math.PI / 180) * 0.1;
        const currentRwRestRotZ = rwa * (Math.PI / 180) * 0.1;
        const currentRhOffset = (rh - 50) / 100;

        const dragFactor = (fwa + rwa) / 75; // 0 to 1
        const porpoisingRisk = Math.max(0, (30 - rh) / 10);
        const instabilityAmount = (speedBase / 300) * (dragFactor * 0.5 + porpoisingRisk * 1.5);

        // Apply Flutter & Vibration visuals
        const flutterScale = instabilityAmount * 0.1; // Increased visibility
        fwGroup.rotation.z = currentFwRestRotZ + (Math.random() - 0.5) * flutterScale * 1.5;
        rwGroup.rotation.z = currentRwRestRotZ + (Math.random() - 0.5) * flutterScale * 2.5;
        
        // Apply vibration to Chassis based on porpoising
        const vibration = Math.sin(time * 0.05) * (instabilityAmount * 0.04) + (Math.random() - 0.5) * (instabilityAmount * 0.02);
        carGroup.position.y = isNaN(vibration) ? currentRhOffset : (currentRhOffset + vibration);

        for (let i = 0; i < particleCount; i++) {
          const yawAngle = windYawRef.current * (Math.PI / 180);
          const velX = pVelocities[i] * Math.cos(yawAngle);
          const velZ = pVelocities[i] * Math.sin(yawAngle);

          pos[i * 3] -= velX; // Move against X
          pos[i * 3 + 2] -= velZ; // Move against Z

          // Flow dynamics over the car 
          const px = pos[i * 3];
          let py = pos[i * 3 + 1];
          let pz = pos[i * 3 + 2];
          
          if (px > -2.8 && px < 2.8 && Math.abs(pz) < 1.4 && py < 1.5) {
            // Tires - approximate bounding cylinders
            const isFrontWheel = px < 1.6 && px > 0.8 && Math.abs(pz) > 0.5 && Math.abs(pz) < 1.3 && py < 0.8;
            const isRearWheel = px < -1.0 && px > -1.8 && Math.abs(pz) > 0.5 && Math.abs(pz) < 1.3 && py < 0.8;
            
            if (isFrontWheel || isRearWheel) {
               // Push outward from tire center
               const zPush = pz > 0 ? 0.35 : -0.35;
               pz += zPush;
               py += 0.15; // Upward wash over tires
            } else if (Math.abs(pz) < 0.8) {
               // Chassis Body Zone
               // Approximate curved profile of the car from the side
               const carProfileY = (px > 0) 
                  ? 0.5 + Math.max(0, (1.5 - Math.abs(px - 1.0))) * 0.2 // Nose sloping up
                  : 0.8 - Math.abs(px) * 0.1; // Rear sloping down
                  
               if (py < carProfileY) {
                  // Particle is inside the car body volume
                  // Deflect it up or out based on distance to edges
                  const distUp = carProfileY - py;
                  const distOut = 0.8 - Math.abs(pz);
                  
                  if (distUp < distOut * 0.8) {
                     // Closer to top edge, push up
                     py += 0.6 * distUp + 0.15;
                  } else {
                     // Closer to side edge, push out
                     pz += (pz > 0 ? 0.3 : -0.3);
                  }
               }

               // Front Wing dynamics
               if (px < 2.5 && px > 1.8 && py < 0.3) {
                  py += fwa * 0.015; 
               }

               // Halo and engine cover up-flow
               if (px < 1.0 && px > -0.5 && py > 0.6 && py < 1.2) {
                  py += 0.12;
               }

               // Rear wing up-kick
               if (px < -1.2 && px > -2.0 && py > 0.5 && py < 1.8) {
                  py += rwa * 0.025;
               }
            }
          }

          // Vertical Turbulence near wings
          if (px < 2.6 && px > 2.2 && Math.abs(pz) < 0.9) {
             py += fwa * 0.0002 + (Math.random() - 0.5) * flutterScale * 0.1;
          }
          if (px < -1.4 && px > -1.8 && Math.abs(pz) < 0.6) {
             py += rwa * 0.0005 + (Math.random() - 0.5) * flutterScale * 0.2;
          }

          pos[i * 3 + 1] = py;
          pos[i * 3 + 2] = pz;

          // Color based on X position (Heatmap style)
          // Range from X=8 (Red/Hot) to X=-8 (Blue/Cold)
          const colorVal = (pos[i * 3] + 8) / 16; // Normalised to [0, 1]
          col[i * 3] = 0.4 + (1 - colorVal) * 0.6; // R
          col[i * 3 + 1] = 0.5 + colorVal * 0.3; // G
          col[i * 3 + 2] = 0.8 + colorVal * 0.2; // B

          if (pos[i * 3] < -8 || pos[i * 3 + 2] < -6 || pos[i * 3 + 2] > 6) {
            resetParticle(i, pos, pVelocities, false);
          }
        }
        
        // Animate DRS flap
        if (rwTopMeshRef.current) {
           const currentRot = rwTopMeshRef.current.rotation.z;
           const targetRot = drsActiveRef.current ? Math.PI / 16 : -Math.PI / 16;
           rwTopMeshRef.current.rotation.z += (targetRot - currentRot) * 0.1;
        }

        // Animate DRS Light
        if (drsLightRef.current) {
           const targetIntensity = drsActiveRef.current ? 5 : 0;
           drsLightRef.current.intensity += (targetIntensity - drsLightRef.current.intensity) * 0.1;
        }

        pGeometry.attributes.position.needsUpdate = true;
        pGeometry.attributes.color.needsUpdate = true;

        if (sprayCount > 0 && sprayParticles.geometry) {
           const sPos = sprayParticles.geometry.attributes.position.array as Float32Array;
           const sLife = sprayParticles.geometry.attributes.life.array as Float32Array;
           for(let i=0; i<sprayCount; i++) {
              sLife[i] -= 0.015;
              if (sLife[i] <= 0) {
                 // reset
                 const wheelIdx = i % 4;
                 const wPos = wheels[wheelIdx] ? wheels[wheelIdx].position.toArray() : [0,0,0];
                 const isRear = wPos[0] < 0;
                 sPos[i * 3] = wPos[0] - 0.4 - Math.random() * 0.4; 
                 sPos[i * 3 + 1] = 0.1 + Math.random() * 0.1;
                 sPos[i * 3 + 2] = wPos[2] + (Math.random() - 0.5) * 0.5;
                 
                 sprayVel[i * 3] = -0.1 - Math.random() * 0.2 - (isRear ? 0.3 : 0.0);
                 sprayVel[i * 3 + 1] = 0.05 + Math.random() * 0.1;
                 sprayVel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
                 
                 sLife[i] = 1.0;
              } else {
                 sPos[i * 3] += sprayVel[i * 3] * currentSpeedFactor * 1.5;
                 sPos[i * 3 + 1] += sprayVel[i * 3 + 1] * currentSpeedFactor * 1.5;
                 const yawAngle = windYawRef.current * (Math.PI / 180);
                 const windZ = Math.sin(yawAngle) * -0.15;
                 sPos[i * 3 + 2] += (sprayVel[i * 3 + 2] + windZ) * currentSpeedFactor * 1.5;
                 sprayVel[i * 3 + 1] -= 0.002; // gravity effect on spray
                 // apply turbulence
                 sPos[i * 3 + 2] += Math.sin(time * 0.05 + i) * 0.02 * currentSpeedFactor;
                 // diffuse outward and upward if behind car
                 if (sPos[i * 3] < -2) {
                    sPos[i * 3 + 1] += (sPos[i*3+1] * (0.01 + Math.random()*0.02)); 
                 }
              }
           }
           sprayParticles.geometry.attributes.position.needsUpdate = true;
           sprayParticles.geometry.attributes.life.needsUpdate = true;
        }

        // Telemetry Update Logic - Throttled to 10fps
        if (time - lastUpdate > 100) {
          let currentErs = latestTelemetryRef.current?.ers ?? 100;
          let speedMod = 0;
          if (ersModeRef.current === 'regen') {
            currentErs = Math.min(100, currentErs + 0.5);
            speedMod = -5; // Speed penalty for regen
          } else if (ersModeRef.current === 'boost') {
            if (currentErs > 0) {
              currentErs = Math.max(0, currentErs - 1.0);
              speedMod = 15; // Speed boost
            }
          } else {
            // Neutral slow drain or stable
            currentErs = Math.max(0, currentErs - 0.1);
          }

          if (drsActiveRef.current) {
            speedMod += 20; // DRS speed boost
          }

          let weatherSpeedPenalty = 0;
          let weatherInstability = 0;
          if (setupRef.current.tireType === 'Intermediate') {
             weatherSpeedPenalty = 20;
             weatherInstability = 0.5;
          } else if (setupRef.current.tireType === 'Wet') {
             weatherSpeedPenalty = 45;
             weatherInstability = 1.2;
          }

          const speed = Math.max(0, speedBase - weatherSpeedPenalty + Math.random() * 10 - (instabilityAmount * 5) + speedMod);
          
          // Noise factor proportional to instability
          const finalInstability = instabilityAmount + weatherInstability;
          const noise = 1 + (Math.random() - 0.5) * finalInstability * 0.2;

          const cl = ((setupRef.current.frontWingAngle / 15) + (setupRef.current.rearWingAngle / 10) + (80 - setupRef.current.rideHeight) / 50) * noise;
          let cd = (0.6 + (setupRef.current.rearWingAngle / 40) + (setupRef.current.frontWingAngle / 60)) * (1 + (Math.random() - 0.5) * finalInstability * 0.1);
          
          if (drsActiveRef.current) {
             cd *= 0.75; // DRS cuts 25% drag
          }
          
          const calculatedDf = 2000 * cl * (speed / 300);
          const calculatedDrag = 800 * cd * (speed / 300);
          const balance = (setupRef.current.frontWingAngle / (setupRef.current.frontWingAngle + setupRef.current.rearWingAngle)) * 100 + (Math.random() - 0.5) * finalInstability * 2;
          
          const maxWear = Math.max(
            latestTelemetryRef.current?.tireWear?.fl || 0,
            latestTelemetryRef.current?.tireWear?.fr || 0,
            latestTelemetryRef.current?.tireWear?.rl || 0,
            latestTelemetryRef.current?.tireWear?.rr || 0
          );
          const heatFromWear = (maxWear / 100) * 35; // Tires get much hotter as they wear
          const tempBase = (setupRef.current.tireType === 'Wet' ? 65 : (setupRef.current.tireType === 'Intermediate' ? 75 : 90)) + heatFromWear;
          
          const tempVariance = Math.random() * 2 - 1 + finalInstability * 2;
          const tireTemp = {
            fl: tempBase + (setupRef.current.frontWingAngle / 5) + tempVariance,
            fr: tempBase + (setupRef.current.frontWingAngle / 5) - tempVariance,
            rl: tempBase + (setupRef.current.rearWingAngle / 4) + (80 - setupRef.current.rideHeight) / 10 + tempVariance,
            rr: tempBase + (setupRef.current.rearWingAngle / 4) + (80 - setupRef.current.rideHeight) / 10 - tempVariance,
          };
          
          // Apply visual overheating cues if temps exceed 115C
          const tireKeys = ['fl', 'fr', 'rl', 'rr'] as const;
          tireKeys.forEach((key, idx) => {
            const temp = tireTemp[key];
            const tireMesh = wheels[idx].children[0] as THREE.Mesh;
            const material = tireMesh.material as THREE.MeshStandardMaterial;
            if (material.userData.originalColor) {
              if (temp > 115) {
                const heatFactor = Math.min(1.0, (temp - 115) / 15);
                const shimmer = (Math.sin(time * 0.03 + idx) * 0.5 + 0.5) * heatFactor * 0.6;
                const heatColor = new THREE.Color(0xff3300);
                
                material.color.copy(material.userData.originalColor as THREE.Color).lerp(heatColor, shimmer * 0.5);
                material.emissive.copy(heatColor).multiplyScalar(shimmer * 0.2);
              } else {
                material.color.copy(material.userData.originalColor as THREE.Color);
                material.emissive.setHex(0x000000);
              }
            }
          });
          
          const wearRateBase = 0.005;
          const tireWear = {
            fl: Math.min(100, (latestTelemetryRef.current?.tireWear?.fl || 0) + wearRateBase * (tireTemp.fl / 90) * (balance / 50)),
            fr: Math.min(100, (latestTelemetryRef.current?.tireWear?.fr || 0) + wearRateBase * (tireTemp.fr / 90) * (balance / 50)),
            rl: Math.min(100, (latestTelemetryRef.current?.tireWear?.rl || 0) + wearRateBase * (tireTemp.rl / 90) * ((100 - balance) / 50)),
            rr: Math.min(100, (latestTelemetryRef.current?.tireWear?.rr || 0) + wearRateBase * (tireTemp.rr / 90) * ((100 - balance) / 50)),
          };

          const baseTrackLengthKm = 5.0; // 5km circuit
          const lapTimeInSeconds = (baseTrackLengthKm / Math.max(1, speed)) * 3600 + (Math.random() - 0.5) * 0.2;

          onTelemetryUpdate({
            speed: speed,
            downforce: calculatedDf,
            drag: calculatedDrag,
            cl: cl,
            cd: cd,
            balance,
            instability: finalInstability,
            tireTemp,
            tireWear,
            ers: currentErs,
            lapTime: lapTimeInSeconds,
            timestamp: Date.now()
          });
          lastUpdate = time;
        }
      }

      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(animate);

    // 7. Cleanup & Resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      
      scene.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m: any) => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      particleTexture.dispose();
      if ((sprayParticles as any).material && (sprayParticles as any).material.map) {
         (sprayParticles as any).material.map.dispose();
      }

      renderer.dispose();

      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [isSimulating, setup.tireType, carModel]);

  return (
    <div ref={containerRef} className={cn("w-full h-full relative overflow-hidden bg-black border border-white/10 shadow-inner group", isFullscreen ? "rounded-none" : "rounded-xl")}>
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10 w-48">
        <div className="flex gap-1">
          <ViewportBtn label="ORTHO" active={view === 'ORTHO'} onClick={() => setView('ORTHO')} />
          <ViewportBtn label="ISO" active={view === 'ISO'} onClick={() => setView('ISO')} />
          <ViewportBtn label="FRONT" active={view === 'FRONT'} onClick={() => setView('FRONT')} />
        </div>
        
        <div className="bg-black/50 border border-white/10 rounded p-2 backdrop-blur-sm shadow-xl transition-opacity hover:opacity-100 opacity-60">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Wind Yaw (<span className="text-white">{windYaw > 0 ? '+' : ''}{windYaw.toFixed(1)}°</span>)</span>
            <button 
              onClick={() => setWindYaw(0)}
              className="text-[8px] text-slate-500 hover:text-white px-1 border border-white/10 rounded bg-white/5 transition-colors"
            >
              RESET
            </button>
          </div>
          <input 
            type="range" 
            min="-20" 
            max="20" 
            step="0.5"
            value={windYaw}
            onChange={(e) => setWindYaw(parseFloat(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 z-10 p-2 bg-black/50 hover:bg-white/10 border border-white/10 rounded text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10">
        <span className="text-[10px] font-mono text-emerald-400 tracking-tighter uppercase font-bold">Flow Velocity Map</span>
        <div className="w-32 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-rose-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
        <div className="flex justify-between w-32 text-[8px] font-mono text-slate-500 mb-2">
          <span>0 M/S</span>
          <span>120 M/S</span>
        </div>
        
        {drsActive && (
          <div className="mt-2 bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-3 py-1 rounded shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_5px_#34d399]"></div>
            <span className="text-[12px] font-bold tracking-widest uppercase">DRS ACTIVE</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-mono text-slate-600 z-10 tracking-widest">
        <span>X: 1.42</span>
        <span>Y: -0.02</span>
        <span>Z: 0.11</span>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 h-full w-full">
         {/* Schematic Background Lines */}
         <svg className="w-full h-full" viewBox="0 0 100 100">
            <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.1" />
            <line x1="50" y1="0" x2="50" y2="100" stroke="white" strokeWidth="0.1" />
            <circle cx="50" cy="50" r="20" stroke="white" strokeWidth="0.05" fill="none" />
         </svg>
      </div>

      {/* Tire Temperature & Wear HUD */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translate(${hudPos.x}px, ${hudPos.y}px)` }}
        className="absolute bottom-4 right-4 z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-2 flex flex-col gap-2 min-w-[200px] cursor-grab active:cursor-grabbing hover:border-white/20 transition-colors"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center flex-1">Tyre Status</span>
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TireNode 
            label="FL" 
            temp={latestTelemetry?.tireTemp?.fl || 90} 
            wear={latestTelemetry?.tireWear?.fl || 0} 
          />
          <TireNode 
            label="FR" 
            temp={latestTelemetry?.tireTemp?.fr || 90} 
            wear={latestTelemetry?.tireWear?.fr || 0} 
          />
          <TireNode 
            label="RL" 
            temp={latestTelemetry?.tireTemp?.rl || 90} 
            wear={latestTelemetry?.tireWear?.rl || 0} 
          />
          <TireNode 
            label="RR" 
            temp={latestTelemetry?.tireTemp?.rr || 90} 
            wear={latestTelemetry?.tireWear?.rr || 0} 
          />
        </div>
      </div>
    </div>
  );
};

const TireNode = ({ label, temp, wear }: { label: string; temp: number; wear: number }) => {
  const getTempColor = (t: number) => {
    if (t < 85) return 'text-blue-400';
    if (t < 105) return 'text-emerald-400';
    if (t < 115) return 'text-amber-400';
    return 'text-rose-500';
  };

  const getTempBg = (t: number) => {
    if (t < 85) return 'bg-blue-500/20';
    if (t < 105) return 'bg-emerald-500/20';
    if (t < 115) return 'bg-amber-500/20';
    return 'bg-rose-500/20';
  };

  const getWearColor = (w: number) => {
    if (w < 40) return 'bg-emerald-400';
    if (w < 70) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  return (
    <div className={cn("flex flex-col items-center justify-center p-1.5 rounded border border-white/5 min-w-[48px]", getTempBg(temp))}>
      <span className="text-[8px] text-slate-500 font-mono">{label}</span>
      <span className={cn("text-[11px] font-bold font-mono", getTempColor(temp))}>{temp.toFixed(0)}°</span>
      {/* Temp Bar */}
      <div className="w-full h-0.5 mt-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={cn("h-full", getTempColor(temp).replace('text', 'bg'))} 
          style={{ width: `${Math.min(100, Math.max(0, (temp - 60) / 0.8))}%` }} 
        />
      </div>
      {/* Wear Bar */}
      <div className="flex justify-between w-full mt-1 items-center gap-1">
        <span className="text-[7px] text-slate-400 font-mono">WEAR</span>
        <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden shrink-0">
          <div 
            className={cn("h-full", getWearColor(wear))} 
            style={{ width: `${Math.min(100, Math.max(0, wear))}%` }} 
          />
        </div>
        <span className="text-[7px] text-slate-400 font-mono">{wear.toFixed(0)}%</span>
      </div>
    </div>
  );
};

const ViewportBtn = ({ label, active, onClick }: { label: string, active?: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
    "px-2 py-1 border text-[9px] font-bold tracking-tighter transition-all cursor-pointer pointer-events-auto z-50 relative",
    active 
      ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" 
      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
  )}>
    {label}
  </button>
);
