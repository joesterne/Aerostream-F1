import React, { useRef, useEffect, useState, MouseEvent as ReactMouseEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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

  const [view, setView] = useState<'ISO' | 'ORTHO' | 'FRONT'>('ISO');
  const viewRef = useRef(view);

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
    scene.background = new THREE.Color(0x020202);
    scene.fog = new THREE.Fog(0x020202, 10, 40);
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.zIndex = '0';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow a bit below ground
    controls.minDistance = 3;
    controls.maxDistance = 25;
    controls.target.set(0, 0.5, 0);

    // 2. Advanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.SpotLight(0xffffff, 150, 50, Math.PI / 4, 0.8, 1);
    mainLight.position.set(5, 10, 5);
    mainLight.lookAt(0, 0, 0);
    scene.add(mainLight);

    const rimLight = new THREE.SpotLight(0x818cf8, 100, 50, Math.PI / 4, 0.8, 1);
    rimLight.position.set(-8, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 3. Grid & Environment
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.8 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.05;
    scene.add(floorMesh);

    // Wind Tunnel Room / Walls
    const roomGeo = new THREE.CylinderGeometry(14, 14, 100, 32, 1, true);
    const roomMat = new THREE.MeshStandardMaterial({ 
      color: 0x111115, 
      roughness: 0.7, 
      metalness: 0.3, 
      side: THREE.BackSide 
    });
    const roomMesh = new THREE.Mesh(roomGeo, roomMat);
    roomMesh.rotation.z = Math.PI / 2;
    roomMesh.position.y = 4;
    scene.add(roomMesh);

    // Tunnel Ceiling Strip Lights
    const stripGeo = new THREE.PlaneGeometry(100, 0.4);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
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
    const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.9, color: 0x888888 });
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
      new THREE.TorusGeometry(3.5, 0.5, 16, 64),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })
    );
    fanGroup.add(fanCasing);
    
    const bladeGeo = new THREE.BoxGeometry(0.1, 6.8, 0.6);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 });
    const bladeGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
       const blade = new THREE.Mesh(bladeGeo, bladeMat);
       blade.rotation.z = (i * Math.PI * 2) / 7;
       blade.rotation.y = 0.4; // pitch
       bladeGroup.add(blade);
    }
    fanGroup.add(bladeGroup);
    fanBladeRef.current = bladeGroup;
    scene.add(fanGroup);

    // 4. Detailed Car Construction
    const carGroup = new THREE.Group();
    const matCarbon = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.4 });
    const matPaint = new THREE.MeshPhysicalMaterial({ 
      color: 0x111625, 
      metalness: 0.1, 
      roughness: 0.85,
      clearcoat: 0.0
    });
    const matYellow = new THREE.MeshStandardMaterial({ color: 0xecca00, roughness: 0.4, metalness: 0.1 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.4, metalness: 0.1 });
    const matAccent = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.4 });

    let wheelPositions: number[][] = [];
    const rhOffset = (setup.rideHeight - 50) / 100;
    
    // Dynamic Front Wing Group
    const fwGroup = new THREE.Group();
    const fwRestRotZ = -setup.frontWingAngle * (Math.PI / 180) * 0.1;
    
    // Dynamic Rear Wing Group
    const rwGroup = new THREE.Group();
    const rwRestRotZ = setup.rearWingAngle * (Math.PI / 180) * 0.1;
    
    // DRS Light 
    const drsLight = new THREE.PointLight(0x00ff00, 0, 2);
    drsLight.position.set(0, 0.4, 0);
    rwGroup.add(drsLight);
    drsLightRef.current = drsLight;

    if (carModel === 'Formula 1') {
      // Chassis Base (sleeker with Capsule)
      const chassisGeo = new THREE.CapsuleGeometry(0.25, 2.5, 8, 16);
      chassisGeo.rotateZ(Math.PI / 2);
      const chassis = new THREE.Mesh(chassisGeo, matPaint);
      chassis.scale.set(1, 0.8, 1.3); // Flatten slightly, widen
      chassis.position.set(0, 0.35, 0);
      carGroup.add(chassis);

      // Floor & Diffuser (Cylinder for rounded front)
      const floorGeo = new THREE.CylinderGeometry(0.7, 0.7, 4.0, 32);
      floorGeo.rotateZ(Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, matCarbon);
      floor.scale.set(1, 0.05, 1);
      floor.position.set(-0.2, 0.15, 0);
      carGroup.add(floor);
      
      // Sidepods (Capsules)
      const sidepodGeo = new THREE.CapsuleGeometry(0.18, 1.2, 8, 16);
      sidepodGeo.rotateZ(Math.PI / 2);
      const sidepodL = new THREE.Mesh(sidepodGeo, matPaint);
      sidepodL.scale.set(1, 0.8, 1.2);
      sidepodL.position.set(-0.2, 0.35, 0.5);
      const sidepodR = sidepodL.clone();
      sidepodR.position.z = -0.5;
      carGroup.add(sidepodL, sidepodR);

      // Engine Cover & Airbox
      const engineGeo = new THREE.CylinderGeometry(0.05, 0.2, 1.4, 16);
      engineGeo.rotateZ(-Math.PI / 2);
      const engineCover = new THREE.Mesh(engineGeo, matPaint);
      engineCover.position.set(-0.5, 0.55, 0);
      engineCover.scale.set(1, 1, 0.6);

      const engineRedDecalGeo = new THREE.CylinderGeometry(0.22, 0.37, 0.8, 32);
      engineRedDecalGeo.rotateZ(Math.PI / 2);
      const engineRedDecal = new THREE.Mesh(engineRedDecalGeo, matRed);
      engineRedDecal.position.set(-0.5, 0.55, 0);
      engineRedDecal.scale.set(1, 1, 0.62);

      const airboxGeo = new THREE.CapsuleGeometry(0.12, 0.4, 8, 16);
      const airbox = new THREE.Mesh(airboxGeo, matYellow);
      airbox.position.set(-0.1, 0.75, 0);
      airbox.rotation.z = -Math.PI / 8;
      carGroup.add(engineCover, engineRedDecal, airbox);

      // Halo
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 8, 24, Math.PI), matCarbon);
      halo.position.set(0.3, 0.62, 0);
      halo.rotation.y = Math.PI / 2;
      halo.rotation.x = -Math.PI / 8;
      carGroup.add(halo);

      // Nose
      const noseGeo = new THREE.CylinderGeometry(0.08, 0.2, 1.2, 16);
      noseGeo.rotateZ(-Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, matPaint);
      nose.scale.set(1, 0.5, 1.2);
      nose.position.set(1.9, 0.25, 0);
      
      const noseTipGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const noseTip = new THREE.Mesh(noseTipGeo, matYellow);
      noseTip.scale.set(1, 0.5, 1.2);
      noseTip.position.set(2.5, 0.25, 0);

      const noseRedDecalGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.6, 32);
      noseRedDecalGeo.rotateZ(Math.PI / 2);
      const noseRedDecal = new THREE.Mesh(noseRedDecalGeo, matRed);
      noseRedDecal.scale.set(1, 0.52, 1.25);
      noseRedDecal.position.set(1.9, 0.25, 0);

      carGroup.add(nose, noseTip, noseRedDecal);

      // F1 Front Wing
      const fwMainGeo = new THREE.CapsuleGeometry(0.02, 1.8, 8, 16);
      fwMainGeo.rotateX(Math.PI / 2);
      const fwMain = new THREE.Mesh(fwMainGeo, matCarbon);
      fwMain.scale.set(8, 1, 1);
      
      const fwFlapGeo = new THREE.CapsuleGeometry(0.015, 1.7, 8, 16);
      fwFlapGeo.rotateX(Math.PI / 2);
      const fwFlap1 = new THREE.Mesh(fwFlapGeo, matRed);
      fwFlap1.scale.set(12, 1, 1);
      fwFlap1.position.set(-0.15, 0.05, 0);
      fwFlap1.rotation.z = Math.PI / 16;
      
      const fwEndplateGeo = new THREE.CapsuleGeometry(0.15, 0.1, 8, 16);
      fwEndplateGeo.rotateZ(Math.PI / 2);
      const fwEndplateL = new THREE.Mesh(fwEndplateGeo, matPaint);
      fwEndplateL.scale.set(1, 1, 0.2);
      fwEndplateL.position.set(0, 0.1, 0.9);
      const fwEndplateR = fwEndplateL.clone();
      fwEndplateR.position.z = -0.9;
      fwGroup.add(fwMain, fwFlap1, fwEndplateL, fwEndplateR);
      fwGroup.position.set(2.4, 0.15, 0);
      fwGroup.rotation.z = fwRestRotZ;
      carGroup.add(fwGroup);

      // F1 Rear Wing
      const rwMainGeo = new THREE.CapsuleGeometry(0.02, 1.4, 8, 16);
      rwMainGeo.rotateX(Math.PI / 2);
      const rwMain = new THREE.Mesh(rwMainGeo, matPaint);
      rwMain.scale.set(12, 1, 1);
      
      const rwTopGeo = new THREE.CapsuleGeometry(0.015, 1.4, 8, 16);
      rwTopGeo.rotateX(Math.PI / 2);
      const rwTop = new THREE.Mesh(rwTopGeo, matRed);
      rwTop.scale.set(12, 1, 1);
      rwTopMeshRef.current = rwTop;
      rwTop.position.set(-0.1, 0.15, 0);
      rwTop.rotation.z = -Math.PI / 16;
      
      const rwEndGeo = new THREE.CapsuleGeometry(0.35, 0.35, 8, 16);
      rwEndGeo.rotateZ(Math.PI / 2);
      const rwEndplateL = new THREE.Mesh(rwEndGeo, matPaint);
      rwEndplateL.scale.set(1, 1, 0.1);
      rwEndplateL.position.set(0, 0.1, 0.7);
      const rwEndplateR = rwEndplateL.clone();
      rwEndplateR.position.z = -0.7;
      const rwPillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), matCarbon);
      rwPillar.position.set(-0.1, -0.3, 0);
      rwGroup.add(rwMain, rwTop, rwEndplateL, rwEndplateR, rwPillar);
      rwGroup.position.set(-1.7, 0.7 + rhOffset, 0);
      rwGroup.rotation.z = rwRestRotZ;
      carGroup.add(rwGroup);

      // F1 Suspension
      const flSusp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), matCarbon);
      flSusp.position.set(1.2, 0.3, 0.5);
      flSusp.rotation.x = Math.PI / 2;
      carGroup.add(flSusp);
      const frSusp = flSusp.clone();
      frSusp.position.z = -0.5;
      carGroup.add(frSusp);

      wheelPositions = [
        [1.2, 0.35, 0.85], [1.2, 0.35, -0.85],
        [-1.3, 0.36, 0.9], [-1.3, 0.36, -0.9]
      ];
    } else if (carModel === 'Hypercar') {
      // Hypercar Chassis (Wider, closed cockpit)
      // Main Body Capsule
      const bodyGeo = new THREE.CapsuleGeometry(0.6, 2.5, 16, 32);
      bodyGeo.rotateZ(Math.PI / 2);
      const chassis = new THREE.Mesh(bodyGeo, matPaint);
      chassis.scale.set(1, 0.35, 1.15); 
      chassis.position.y = 0.4;
      carGroup.add(chassis);

      // Floor & Diffuser (Cylinder based)
      const floorGeo = new THREE.CylinderGeometry(0.9, 0.9, 4.4, 32);
      floorGeo.rotateZ(Math.PI / 2);
      const floor = new THREE.Mesh(floorGeo, matCarbon);
      floor.scale.set(1, 0.05, 1);
      floor.position.set(-0.1, 0.15, 0);
      carGroup.add(floor);

      // Cockpit Canopy (rounded top)
      const canopyGeo = new THREE.SphereGeometry(0.6, 32, 16);
      const canopy = new THREE.Mesh(canopyGeo, matCarbon);
      canopy.scale.set(1.4, 0.6, 0.8);
      canopy.position.set(0, 0.65, 0);
      carGroup.add(canopy);
      
      // LMP Nose
      const noseGeo = new THREE.ConeGeometry(0.7, 1.2, 32);
      noseGeo.rotateZ(-Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, matPaint);
      nose.scale.set(1, 0.25, 0.9);
      nose.position.set(2.4, 0.3, 0);
      carGroup.add(nose);
      
      // LMP Rear fin
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.03), matCarbon);
      fin.position.set(-1.0, 0.75, 0);
      carGroup.add(fin);

      // LMP Front Wing setup
      const fwMainGeo = new THREE.CylinderGeometry(0.04, 0.01, 1.8, 16);
      fwMainGeo.rotateX(Math.PI / 2);
      const fwMain = new THREE.Mesh(fwMainGeo, matCarbon);
      fwMain.scale.set(6, 1, 1);
      fwMain.position.set(0, 0, 0);
      fwGroup.add(fwMain);
      fwGroup.position.set(2.5, 0.2, 0);
      fwGroup.rotation.z = fwRestRotZ;
      carGroup.add(fwGroup);

      // LMP Rear Wing setup
      const rwMain = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 1.6), matCarbon);
      const rwTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 1.6), matAccent);
      rwTopMeshRef.current = rwTop;
      rwTop.position.set(-0.1, 0.1, 0);
      rwTop.rotation.z = -Math.PI / 16;
      const rwEndplateL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), matCarbon);
      rwEndplateL.position.set(0, -0.1, 0.8);
      const rwEndplateR = rwEndplateL.clone();
      rwEndplateR.position.z = -0.8;
      rwGroup.add(rwMain, rwTop, rwEndplateL, rwEndplateR);
      rwGroup.position.set(-1.8, 0.8 + rhOffset, 0);
      rwGroup.rotation.z = rwRestRotZ;
      carGroup.add(rwGroup);

      wheelPositions = [
        [1.3, 0.35, 0.9], [1.3, 0.35, -0.9],
        [-1.3, 0.36, 0.9], [-1.3, 0.36, -0.9]
      ];
    } else {
      // GT3 Model
      // GT3 Chassis (Boxier but smoothed)
      const bodyGeo = new THREE.CapsuleGeometry(0.75, 2.2, 16, 16);
      bodyGeo.rotateZ(Math.PI / 2);
      const chassis = new THREE.Mesh(bodyGeo, matPaint);
      chassis.scale.set(1, 0.55, 1.0);
      chassis.position.set(0, 0.5, 0);
      carGroup.add(chassis);

      // Floor & Splitter
      const floorGeo = new THREE.PlaneGeometry(4.4, 1.8);
      const floorMatMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.8 });
      const floor = new THREE.Mesh(floorGeo, floorMatMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0.15, 0);
      carGroup.add(floor);

      // Cabin / Roof (smoothed)
      const cabinGeo = new THREE.SphereGeometry(0.7, 32, 16);
      const cabin = new THREE.Mesh(cabinGeo, matCarbon);
      cabin.scale.set(1.1, 0.6, 0.8);
      cabin.position.set(-0.1, 0.7, 0);
      carGroup.add(cabin);

      // Hood
      const hoodGeo = new THREE.CylinderGeometry(0.2, 0.8, 1.4, 16);
      hoodGeo.rotateZ(-Math.PI / 2);
      const hood = new THREE.Mesh(hoodGeo, matPaint);
      hood.scale.set(1, 0.3, 1.1);
      hood.position.set(1.2, 0.45, 0);
      hood.rotation.z = -Math.PI / 32;
      carGroup.add(hood);

      // Trunk
      const trunkGeo = new THREE.BoxGeometry(1.0, 0.3, 1.5);
      const trunk = new THREE.Mesh(trunkGeo, matPaint);
      trunk.position.set(-1.4, 0.6, 0);
      carGroup.add(trunk);

      // GT3 Front Wing (Splitter adjustment)
      const fwMainGeo = new THREE.PlaneGeometry(0.5, 1.8);
      const fwMain = new THREE.Mesh(fwMainGeo, matAccent);
      fwMain.rotation.x = -Math.PI / 2;
      fwGroup.add(fwMain);
      fwGroup.position.set(2.0, 0.18, 0);
      fwGroup.rotation.z = fwRestRotZ;
      carGroup.add(fwGroup);

      // GT3 Rear Wing
      const rwMain = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 1.6), matCarbon);
      const rwTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 1.6), matAccent);
      rwTopMeshRef.current = rwTop;
      rwTop.position.set(-0.1, 0.1, 0);
      rwTop.rotation.z = -Math.PI / 16;
      const rwPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.05), matCarbon);
      rwPillarL.position.set(0, -0.2, 0.4);
      const rwPillarR = rwPillarL.clone();
      rwPillarR.position.z = -0.4;
      const rwEndplateL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.03), matCarbon);
      rwEndplateL.position.set(0, 0, 0.8);
      const rwEndplateR = rwEndplateL.clone();
      rwEndplateR.position.z = -0.8;
      rwGroup.add(rwMain, rwTop, rwPillarL, rwPillarR, rwEndplateL, rwEndplateR);
      rwGroup.position.set(-1.7, 1.0 + rhOffset, 0);
      rwGroup.rotation.z = rwRestRotZ;
      carGroup.add(rwGroup);

      wheelPositions = [
        [1.2, 0.35, 0.8], [1.2, 0.35, -0.8],
        [-1.3, 0.36, 0.8], [-1.3, 0.36, -0.8]
      ];
    }

    // Wheels (Common to all models)
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 64);
    wheelGeo.rotateX(Math.PI / 2);
    const matWheel = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const matWheelRim = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.5 });
    
    const wheels: THREE.Group[] = [];
    wheelPositions.forEach(pos => {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, matWheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.41, 32), matWheelRim);
      rim.rotation.x = Math.PI / 2;
      
      const stripeGeo = new THREE.TorusGeometry(0.3, 0.03, 16, 64);
      const stripeL = new THREE.Mesh(stripeGeo, matYellow);
      
      const isRight = pos[2] < 0;
      if (isRight) {
        stripeL.position.z = -0.205;
      } else {
        stripeL.position.z = 0.205;
      }
      
      wheelGroup.add(tire, rim, stripeL);
      wheelGroup.position.set(pos[0], pos[1] - rhOffset, pos[2]);
      carGroup.add(wheelGroup);
      wheels.push(wheelGroup);
    });

    // Initial Car placement
    wheelsRef.current = wheels;
    carGroup.position.y = rhOffset;
    scene.add(carGroup);

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

    const numStreamsY = 7;
    const numStreamsZ = 21; 

    function resetParticle(i: number, posArr: Float32Array, velArr: Float32Array, initialStagger: boolean = false) {
      const streamIdx = i % (numStreamsY * numStreamsZ);
      const sy = Math.floor(streamIdx / numStreamsZ);
      const sz = streamIdx % numStreamsZ;
      
      const startX = initialStagger ? 8 + Math.random() * 12 : 8;
      
      posArr[i * 3] = startX;
      posArr[i * 3 + 1] = 0.2 + sy * 0.25; // Y
      posArr[i * 3 + 2] = -1.5 + sz * 0.15; // Z
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
    scene.add(particles);
    cloudRef.current = particles;

    // 6. Animation Loop
    let frameId: number;
    let lastUpdate = 0;
    const animate = (time: number = 0) => {
      frameId = requestAnimationFrame(animate);

      controls.update();

      if (isSimulating) {
        const pos = pGeometry.attributes.position.array as Float32Array;
        const col = pGeometry.attributes.color.array as Float32Array;
        const speedBase = 280;
        
        // Dynamic Aerodynamic Instability Calculation
        const fwa = setup.frontWingAngle || 12;
        const rwa = setup.rearWingAngle || 18;
        const rh = setup.rideHeight || 35;

        const dragFactor = (fwa + rwa) / 75; // 0 to 1
        const porpoisingRisk = Math.max(0, (30 - rh) / 10);
        const instabilityAmount = (speedBase / 300) * (dragFactor * 0.5 + porpoisingRisk * 1.5);

        // Apply Flutter & Vibration visuals
        const flutterScale = instabilityAmount * 0.1; // Increased visibility
        fwGroup.rotation.z = fwRestRotZ + (Math.random() - 0.5) * flutterScale * 1.5;
        rwGroup.rotation.z = rwRestRotZ + (Math.random() - 0.5) * flutterScale * 2.5;
        
        // Apply vibration to Chassis based on porpoising
        const vibration = Math.sin(time * 0.05) * (instabilityAmount * 0.04) + (Math.random() - 0.5) * (instabilityAmount * 0.02);
        carGroup.position.y = isNaN(vibration) ? rhOffset : (rhOffset + vibration);

        for (let i = 0; i < particleCount; i++) {
          pos[i * 3] -= pVelocities[i]; // Move against X

          // Flow dynamics over the car 
          // Car bounds approx X from 2.5 to -2.0, Y from 0 to 1.2
          const px = pos[i * 3];
          let py = pos[i * 3 + 1];
          const pz = pos[i * 3 + 2];
          
          if (px > -2.5 && px < 2.8 && Math.abs(pz) < 1.2) {
            // Nose up-kick
            if (px < 2.5 && px > 1.0) {
               py += 0.01;
            }
            // Halo and engine cover up-flow
            if (px < 1.0 && px > -0.5 && py < 1.5) {
               py += 0.015;
            }
            // Rear wing up-kick
            if (px < -1.2 && px > -2.0 && py > 0.5 && py < 1.8) {
               py += rwa * 0.001;
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

          // Color based on X position (Heatmap style)
          // Range from X=8 (Red/Hot) to X=-8 (Blue/Cold)
          const colorVal = (pos[i * 3] + 8) / 16; // Normalised to [0, 1]
          col[i * 3] = 0.4 + (1 - colorVal) * 0.6; // R
          col[i * 3 + 1] = 0.5 + colorVal * 0.3; // G
          col[i * 3 + 2] = 0.8 + colorVal * 0.2; // B

          if (pos[i * 3] < -8) {
            resetParticle(i, pos, pVelocities, false);
          }
        }
        
        // Animate wheels and fan
        if (fanBladeRef.current) {
          fanBladeRef.current.rotation.x -= (speedBase / 300) * 0.3;
        }
        wheelsRef.current.forEach(w => w.rotation.z -= (speedBase / 300) * 0.4);
        if (beltMatRef.current && beltMatRef.current.map) {
          beltMatRef.current.map.offset.x -= (speedBase / 300) * 0.05;
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

          const speed = Math.max(0, speedBase + Math.random() * 10 - (instabilityAmount * 5) + speedMod);
          
          // Noise factor proportional to instability
          const noise = 1 + (Math.random() - 0.5) * instabilityAmount * 0.2;

          const cl = ((setup.frontWingAngle / 15) + (setup.rearWingAngle / 10) + (80 - setup.rideHeight) / 50) * noise;
          let cd = (0.6 + (setup.rearWingAngle / 40) + (setup.frontWingAngle / 60)) * (1 + (Math.random() - 0.5) * instabilityAmount * 0.1);
          
          if (drsActiveRef.current) {
             cd *= 0.75; // DRS cuts 25% drag
          }
          
          const calculatedDf = 2000 * cl * (speed / 300);
          const calculatedDrag = 800 * cd * (speed / 300);
          const balance = (setup.frontWingAngle / (setup.frontWingAngle + setup.rearWingAngle)) * 100 + (Math.random() - 0.5) * instabilityAmount * 2;
          
          const tempBase = 90;
          const tempVariance = Math.random() * 2 - 1 + instabilityAmount * 2;
          const tireTemp = {
            fl: tempBase + (setup.frontWingAngle / 5) + tempVariance,
            fr: tempBase + (setup.frontWingAngle / 5) - tempVariance,
            rl: tempBase + (setup.rearWingAngle / 4) + (80 - setup.rideHeight) / 10 + tempVariance,
            rr: tempBase + (setup.rearWingAngle / 4) + (80 - setup.rideHeight) / 10 - tempVariance,
          };
          
          const wearRateBase = 0.005;
          const tireWear = {
            fl: Math.min(100, (latestTelemetryRef.current?.tireWear?.fl || 0) + wearRateBase * (tireTemp.fl / 90) * (balance / 50)),
            fr: Math.min(100, (latestTelemetryRef.current?.tireWear?.fr || 0) + wearRateBase * (tireTemp.fr / 90) * (balance / 50)),
            rl: Math.min(100, (latestTelemetryRef.current?.tireWear?.rl || 0) + wearRateBase * (tireTemp.rl / 90) * ((100 - balance) / 50)),
            rr: Math.min(100, (latestTelemetryRef.current?.tireWear?.rr || 0) + wearRateBase * (tireTemp.rr / 90) * ((100 - balance) / 50)),
          };

          onTelemetryUpdate({
            speed: speed,
            downforce: calculatedDf,
            drag: calculatedDrag,
            cl: cl,
            cd: cd,
            balance,
            instability: instabilityAmount,
            tireTemp,
            tireWear,
            ers: currentErs,
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
      renderer.dispose();
      matCarbon.dispose();
      matPaint.dispose();
      matAccent.dispose();
      pMaterial.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [isSimulating, setup, carModel]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-black rounded-xl border border-white/10 shadow-inner">
      <div className="absolute top-4 left-4 flex gap-1 z-10">
        <ViewportBtn label="ORTHO" active={view === 'ORTHO'} onClick={() => setView('ORTHO')} />
        <ViewportBtn label="ISO" active={view === 'ISO'} onClick={() => setView('ISO')} />
        <ViewportBtn label="FRONT" active={view === 'FRONT'} onClick={() => setView('FRONT')} />
      </div>
      
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
