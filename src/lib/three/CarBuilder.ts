import * as THREE from 'three';
import { AeroSetup, TelemetryData } from '../../types';

export function buildCarGroup(
  carModel: string,
  setup: AeroSetup,
  matCarbon: THREE.Material,
  matPaint: THREE.Material,
  matYellow: THREE.Material,
  matRed: THREE.Material,
  matAccent: THREE.Material
) {
  const carGroup = new THREE.Group();
  
  let wheelPositions: number[][] = [];
  const rhOffset = (setup.rideHeight - 50) / 100;
  
  // Dynamic Front Wing Group
  const fwGroup = new THREE.Group();
  const fwRestRotZ = -setup.frontWingAngle * (Math.PI / 180) * 0.1;
  
  // Dynamic Rear Wing Group
  const rwGroup = new THREE.Group();
  const rwRestRotZ = setup.rearWingAngle * (Math.PI / 180) * 0.1;

  let rwTopMesh: THREE.Mesh | null = null;
  const drsLight = new THREE.PointLight(0x00ff00, 0, 2);
  drsLight.position.set(0, 0.4, 0);
  rwGroup.add(drsLight);

  if (carModel === 'Formula 1') {
    // Chassis Base (sleeker with Capsule)
    const chassisGeo = new THREE.CapsuleGeometry(0.25, 2.5, 32, 64);
    chassisGeo.rotateZ(Math.PI / 2);
    const chassis = new THREE.Mesh(chassisGeo, matPaint);
    chassis.scale.set(1, 0.8, 1.3); // Flatten slightly, widen
    chassis.position.set(0, 0.35, 0);
    carGroup.add(chassis);

    // Floor & Diffuser (Cylinder for rounded front)
    const floorGeo = new THREE.CylinderGeometry(0.7, 0.7, 4.0, 64);
    floorGeo.rotateZ(Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, matCarbon);
    floor.scale.set(1, 0.05, 1);
    floor.position.set(-0.2, 0.15, 0);
    carGroup.add(floor);
    
    // Sidepods (Capsules)
    const sidepodGeo = new THREE.CapsuleGeometry(0.18, 1.2, 32, 64);
    sidepodGeo.rotateZ(Math.PI / 2);
    const sidepodL = new THREE.Mesh(sidepodGeo, matPaint);
    sidepodL.scale.set(1, 0.8, 1.2);
    sidepodL.position.set(-0.2, 0.35, 0.5);
    const sidepodR = sidepodL.clone();
    sidepodR.position.z = -0.5;
    
    // Bargeboards
    const bargeboardGeo = new THREE.BoxGeometry(0.4, 0.3, 0.02);
    const bargeboardL = new THREE.Mesh(bargeboardGeo, matCarbon);
    bargeboardL.position.set(0.6, 0.25, 0.6);
    bargeboardL.rotation.y = -Math.PI / 12;
    const bargeboardR = bargeboardL.clone();
    bargeboardR.position.z = -0.6;
    bargeboardR.rotation.y = Math.PI / 12;

    carGroup.add(sidepodL, sidepodR, bargeboardL, bargeboardR);

    // Engine Cover & Airbox
    const engineGeo = new THREE.CylinderGeometry(0.05, 0.2, 1.4, 64);
    engineGeo.rotateZ(-Math.PI / 2);
    const engineCover = new THREE.Mesh(engineGeo, matPaint);
    engineCover.position.set(-0.5, 0.55, 0);
    engineCover.scale.set(1, 1, 0.6);

    const engineRedDecalGeo = new THREE.CylinderGeometry(0.22, 0.37, 0.8, 64);
    engineRedDecalGeo.rotateZ(Math.PI / 2);
    const engineRedDecal = new THREE.Mesh(engineRedDecalGeo, matRed);
    engineRedDecal.position.set(-0.5, 0.55, 0);
    engineRedDecal.scale.set(1, 1, 0.62);

    const airboxGeo = new THREE.CapsuleGeometry(0.12, 0.4, 32, 64);
    const airbox = new THREE.Mesh(airboxGeo, matYellow);
    airbox.position.set(-0.1, 0.75, 0);
    airbox.rotation.z = -Math.PI / 8;
    
    // T-cam
    const tCamGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 16);
    tCamGeo.rotateX(Math.PI / 2);
    const tCam = new THREE.Mesh(tCamGeo, matCarbon);
    tCam.position.set(-0.05, 0.82, 0);

    carGroup.add(engineCover, engineRedDecal, airbox, tCam);

    // Halo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 32, 64, Math.PI), matCarbon);
    halo.position.set(0.3, 0.62, 0);
    halo.rotation.y = Math.PI / 2;
    halo.rotation.x = -Math.PI / 8;
    
    // Mirrors
    const mirrorGeo = new THREE.CapsuleGeometry(0.02, 0.1, 16, 16);
    mirrorGeo.rotateX(Math.PI / 2);
    const mirrorL = new THREE.Mesh(mirrorGeo, matPaint);
    mirrorL.position.set(0.4, 0.55, 0.45);
    mirrorL.rotation.y = -Math.PI / 16;
    const mirrorStalkL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1), matCarbon);
    mirrorStalkL.position.set(0.4, 0.5, 0.4);
    mirrorStalkL.rotation.x = Math.PI / 4;
    const mirrorR = mirrorL.clone();
    mirrorR.position.z = -0.45;
    mirrorR.rotation.y = Math.PI / 16;
    const mirrorStalkR = mirrorStalkL.clone();
    mirrorStalkR.position.z = -0.4;
    mirrorStalkR.rotation.x = -Math.PI / 4;
    
    carGroup.add(halo, mirrorL, mirrorStalkL, mirrorR, mirrorStalkR);

    // Nose
    const noseGeo = new THREE.CylinderGeometry(0.08, 0.2, 1.2, 64);
    noseGeo.rotateZ(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, matPaint);
    nose.scale.set(1, 0.5, 1.2);
    nose.position.set(1.9, 0.25, 0);
    
    const noseTipGeo = new THREE.SphereGeometry(0.08, 64, 64);
    const noseTip = new THREE.Mesh(noseTipGeo, matYellow);
    noseTip.scale.set(1, 0.5, 1.2);
    noseTip.position.set(2.5, 0.25, 0);

    const noseRedDecalGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.6, 64);
    noseRedDecalGeo.rotateZ(Math.PI / 2);
    const noseRedDecal = new THREE.Mesh(noseRedDecalGeo, matRed);
    noseRedDecal.scale.set(1, 0.52, 1.25);
    noseRedDecal.position.set(1.9, 0.25, 0);

    carGroup.add(nose, noseTip, noseRedDecal);

    // F1 Front Wing
    const fwMainGeo = new THREE.CapsuleGeometry(0.02, 1.8, 32, 64);
    fwMainGeo.rotateX(Math.PI / 2);
    const fwMain = new THREE.Mesh(fwMainGeo, matCarbon);
    fwMain.scale.set(8, 1, 1);
    
    const fwFlapGeo = new THREE.CapsuleGeometry(0.015, 1.7, 32, 64);
    fwFlapGeo.rotateX(Math.PI / 2);
    const fwFlap1 = new THREE.Mesh(fwFlapGeo, matRed);
    fwFlap1.scale.set(12, 1, 1);
    fwFlap1.position.set(-0.15, 0.05, 0);
    fwFlap1.rotation.z = Math.PI / 16;
    
    const fwEndplateGeo = new THREE.CapsuleGeometry(0.15, 0.1, 32, 64);
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
    const rwMainGeo = new THREE.CapsuleGeometry(0.02, 1.4, 32, 64);
    rwMainGeo.rotateX(Math.PI / 2);
    const rwMain = new THREE.Mesh(rwMainGeo, matPaint);
    rwMain.scale.set(12, 1, 1);
    
    const rwTopGeo = new THREE.CapsuleGeometry(0.015, 1.4, 32, 64);
    rwTopGeo.rotateX(Math.PI / 2);
    const rwTop = new THREE.Mesh(rwTopGeo, matRed);
    rwTop.scale.set(12, 1, 1);
    rwTopMesh = rwTop;
    rwTop.position.set(-0.1, 0.15, 0);
    rwTop.rotation.z = -Math.PI / 16;
    
    const rwEndGeo = new THREE.CapsuleGeometry(0.35, 0.35, 32, 64);
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

    // F1 Suspension Wishbones
    const createSuspension = (x: number, y: number, zStart: number, zEnd: number) => {
      const group = new THREE.Group();
      const length = Math.abs(zEnd - zStart);
      const midZ = (zStart + zEnd) / 2;
      
      // Front arm
      const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, length, 8), matCarbon);
      arm1.position.set(x + 0.1, y + 0.05, midZ);
      arm1.rotation.x = Math.PI / 2;
      arm1.rotation.z = Math.atan2(0.1, length);
      
      // Rear arm
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, length, 8), matCarbon);
      arm2.position.set(x - 0.1, y + 0.05, midZ);
      arm2.rotation.x = Math.PI / 2;
      arm2.rotation.z = -Math.atan2(0.1, length);

      // Lower arm
      const arm3 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, length, 8), matCarbon);
      arm3.position.set(x, y - 0.05, midZ);
      arm3.rotation.x = Math.PI / 2;

      // Pushrod
      const pushrod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, length * 1.2, 8), matCarbon);
      pushrod.position.set(x, y + 0.1, midZ);
      pushrod.rotation.x = Math.PI / 2;
      pushrod.rotation.z = Math.PI / 6;

      group.add(arm1, arm2, arm3, pushrod);
      return group;
    };

    carGroup.add(createSuspension(1.2, 0.3, 0.2, 0.8)); // Front Left
    carGroup.add(createSuspension(1.2, 0.3, -0.2, -0.8)); // Front Right
    carGroup.add(createSuspension(-1.3, 0.3, 0.2, 0.85)); // Rear Left
    carGroup.add(createSuspension(-1.3, 0.3, -0.2, -0.85)); // Rear Right

    wheelPositions = [
      [1.2, 0.35, 0.85], [1.2, 0.35, -0.85],
      [-1.3, 0.36, 0.9], [-1.3, 0.36, -0.9]
    ];
  } else if (carModel === 'Hypercar') {
    // Hypercar Chassis (Wider, closed cockpit)
    // Main Body Capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.6, 2.5, 32, 64);
    bodyGeo.rotateZ(Math.PI / 2);
    const chassis = new THREE.Mesh(bodyGeo, matPaint);
    chassis.scale.set(1, 0.35, 1.15); 
    chassis.position.y = 0.4;
    carGroup.add(chassis);

    // Floor & Diffuser (Cylinder based)
    const floorGeo = new THREE.CylinderGeometry(0.9, 0.9, 4.4, 64);
    floorGeo.rotateZ(Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, matCarbon);
    floor.scale.set(1, 0.05, 1);
    floor.position.set(-0.1, 0.15, 0);
    carGroup.add(floor);

    // Cockpit Canopy (rounded top)
    const windowMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1, clearcoat: 1.0 });
    const canopyGeo = new THREE.SphereGeometry(0.6, 64, 64);
    const canopy = new THREE.Mesh(canopyGeo, windowMat);
    canopy.scale.set(1.4, 0.6, 0.8);
    canopy.position.set(0, 0.65, 0);
    carGroup.add(canopy);
    
    // LMP Nose
    const noseGeo = new THREE.ConeGeometry(0.7, 1.2, 64);
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
    const fwMainGeo = new THREE.CylinderGeometry(0.04, 0.01, 1.8, 64);
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
    rwTopMesh = rwTop;
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
    const bodyGeo = new THREE.CapsuleGeometry(0.75, 2.2, 32, 64);
    bodyGeo.rotateZ(Math.PI / 2);
    const chassis = new THREE.Mesh(bodyGeo, matPaint);
    chassis.scale.set(1, 0.55, 1.0);
    chassis.position.set(0, 0.5, 0);
    carGroup.add(chassis);

    // Windows
    const windowMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.9, roughness: 0.1, clearcoat: 1.0 });

    // Cabin / Roof (smoothed)
    const cabinGeo = new THREE.SphereGeometry(0.7, 64, 64);
    const cabin = new THREE.Mesh(cabinGeo, windowMat);
    cabin.scale.set(1.1, 0.6, 0.8);
    cabin.position.set(-0.1, 0.7, 0);
    
    const roofGeo = new THREE.BoxGeometry(0.9, 0.05, 1.0);
    const roof = new THREE.Mesh(roofGeo, matPaint);
    roof.position.set(-0.1, 1.1, 0);
    carGroup.add(cabin, roof);

    // Floor & Splitter
    const floorGeo = new THREE.BoxGeometry(4.4, 0.05, 1.8);
    const floor = new THREE.Mesh(floorGeo, matCarbon);
    floor.position.set(0, 0.15, 0);
    carGroup.add(floor);

    // Side Skirts
    const skirtGeo = new THREE.BoxGeometry(2.5, 0.1, 1.9);
    const skirt = new THREE.Mesh(skirtGeo, matCarbon);
    skirt.position.set(0, 0.2, 0);
    carGroup.add(skirt);

    // Diffuser
    const diffuserGeo = new THREE.BoxGeometry(0.5, 0.2, 1.6);
    const diffuser = new THREE.Mesh(diffuserGeo, matCarbon);
    diffuser.position.set(-2.0, 0.25, 0);
    diffuser.rotation.z = Math.PI / 16;
    carGroup.add(diffuser);

    // GT3 Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.1, 0.1, 0.2);
    const mirrorL = new THREE.Mesh(mirrorGeo, matPaint);
    mirrorL.position.set(0.4, 0.7, 0.85);
    const mirrorR = mirrorL.clone();
    mirrorR.position.z = -0.85;
    carGroup.add(mirrorL, mirrorR);

    // Hood
    const hoodGeo = new THREE.CylinderGeometry(0.2, 0.8, 1.4, 64);
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
    rwTopMesh = rwTop;
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
  // Visual indicators of wear
  const wearFactor = (setup.tireWear || 0) / 100;
  
  let tireColor = new THREE.Color(0x050505);
  let tireRoughness = 0.9;
  let tireWireframe = false;
  let rimColor = new THREE.Color(0x111111);

  if (wearFactor >= 0.9) {
    // Severe wear (cords showing, heavy graining)
    tireColor = new THREE.Color(0x3a3a3a); // Lighter grey/brown
    tireRoughness = 1.0;
    tireWireframe = true; // Simulates cords/severe blistering
  } else if (wearFactor >= 0.7) {
    // Moderate wear (graining)
    tireColor = new THREE.Color(0x242424); // Dustier grey
    tireRoughness = 0.98;
  } else {
    // Normal wear interpolation
    const baseColor = new THREE.Color(0x050505);
    const lightlyWornColor = new THREE.Color(0x111111);
    tireColor = baseColor.clone().lerp(lightlyWornColor, wearFactor / 0.7);
    tireRoughness = 0.9 + (wearFactor * 0.05);
  }
  
  // Tire Compound specific visuals
  let isGrooved = false;
  if (setup.tireType === 'Intermediate') {
    tireRoughness = Math.max(0.4, tireRoughness - 0.2); // Shinier/wetter
    tireColor.lerp(new THREE.Color(0x1a1a1a), 0.5); // Greying from deeper tread pattern
    isGrooved = true;
  } else if (setup.tireType === 'Wet') {
    tireRoughness = Math.max(0.2, tireRoughness - 0.4); // Very shiny/wet
    tireColor.lerp(new THREE.Color(0x222222), 0.7); // Noticeable greying
    isGrooved = true;
  }
  
  const matWheel = new THREE.MeshStandardMaterial({ 
    color: tireColor, 
    roughness: tireRoughness,
    wireframe: tireWireframe
  });
  
  const matGroove = new THREE.MeshStandardMaterial({
    color: 0x010101,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  });
  const matWheelRim = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.9, roughness: 0.5 });
  
  const wheels: THREE.Group[] = [];
  wheelPositions.forEach(pos => {
    const wheelGroup = new THREE.Group();
    const tireMat = matWheel.clone();
    tireMat.userData.originalColor = tireColor.clone();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    
    if (isGrooved) {
      // Add slightly larger wireframe to represent grooved tire treads
      const grooveGeo = new THREE.CylinderGeometry(0.355, 0.355, 0.39, 48, 8);
      grooveGeo.rotateX(Math.PI / 2);
      const grooveMesh = new THREE.Mesh(grooveGeo, matGroove);
      tire.add(grooveMesh);
    }
    
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.41, 64), matWheelRim);
    rim.rotation.x = Math.PI / 2;
    
    let stripeColor = 0xecca00; // Medium
    if (setup.tireType === 'Soft') stripeColor = 0xcc0000;
    else if (setup.tireType === 'Hard') stripeColor = 0xffffff;
    else if (setup.tireType === 'Intermediate') stripeColor = 0x10b981;
    else if (setup.tireType === 'Wet') stripeColor = 0x0077ff;
    const matStripe = new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.4, metalness: 0.1 });
    
    const stripeGeo = new THREE.TorusGeometry(0.3, 0.03, 32, 128);
    const stripeL = new THREE.Mesh(stripeGeo, matStripe);
    
    const isRight = pos[2] < 0;
    if (isRight) {
      stripeL.position.z = -0.205;
    } else {
      stripeL.position.z = 0.205;
    }
    
    wheelGroup.userData.isWheel = true;
    wheelGroup.add(tire, rim, stripeL);
    wheelGroup.position.set(pos[0], pos[1] - rhOffset, pos[2]);
    carGroup.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // Cleanup help (since geometry needs disposing)
  const geometriesToDispose: THREE.BufferGeometry[] = [wheelGeo];

  return { carGroup, fwGroup, rwGroup, rwTopMesh, drsLight, wheels, geometriesToDispose };
}
