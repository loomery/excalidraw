import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "../types";

interface ThreeDViewProps {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  width: number;
  height: number;
}

type ShapeType = "box" | "sphere" | "cone" | "cylinder";

export const ThreeDView: React.FC<ThreeDViewProps> = ({
  elements,
  appState,
  width,
  height,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const objectsRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const animationIdRef = useRef<number | null>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeType>("box");

  const addShape = useCallback((position: THREE.Vector3, type: ShapeType) => {
    if (!sceneRef.current) return;
    
    console.log("Adding shape", type, "at", position);
    let geometry: THREE.BufferGeometry;

    switch (type) {
      case "box":
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        break;
      case "cone":
        geometry = new THREE.ConeGeometry(0.5, 1, 32);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        break;
    }

    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + 0.5, position.z);
    sceneRef.current.add(mesh);
  }, []);

  useEffect(() => {
    console.log("3D View mounting...", { width, height });
    if (!containerRef.current) {
      console.error("Container ref is null!");
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(
      appState.viewBackgroundColor === "#ffffff" ? 0xf5f5f5 : 0x1e1e1e,
    );
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controlsRef.current = controls;

    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      console.log("Canvas clicked", event);
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(gridHelper);

      console.log("Intersects:", intersects.length);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        addShape(point, selectedShape);
      }
    };

    renderer.domElement.addEventListener("click", onMouseClick);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    console.log("3D View initialized");

    return () => {
      console.log("3D View unmounting");
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
      }
      renderer.domElement.removeEventListener("click", onMouseClick);
      controls.dispose();
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height, appState.viewBackgroundColor, addShape, selectedShape]);

  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const currentObjects = new Map<string, THREE.Mesh>();

    elements.forEach((element) => {
      if (element.isDeleted) return;

      let mesh = objectsRef.current.get(element.id);

      if (!mesh) {
        let geometry: THREE.BufferGeometry;
        
        switch (element.type) {
          case "rectangle":
            geometry = new THREE.BoxGeometry(
              Math.abs(element.width) / 50,
              Math.abs(element.height) / 50,
              1,
            );
            break;
          case "ellipse":
            geometry = new THREE.SphereGeometry(
              Math.max(Math.abs(element.width), Math.abs(element.height)) / 100,
              32,
              32,
            );
            break;
          case "diamond":
            geometry = new THREE.ConeGeometry(
              Math.abs(element.width) / 100,
              Math.abs(element.height) / 50,
              4,
            );
            break;
          default:
            return;
        }

        const color = element.strokeColor || "#000000";
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: element.opacity / 100,
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(element.x / 50, 0, element.y / 50);
        scene.add(mesh);
      }

      currentObjects.set(element.id, mesh);
    });

    objectsRef.current.forEach((mesh, id) => {
      if (!currentObjects.has(id)) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });

    objectsRef.current = currentObjects;
  }, [elements]);

  console.log("ThreeDView rendering", { width, height, selectedShape });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "#000",
        zIndex: 1000,
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(255, 255, 255, 0.9)",
          padding: "10px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          zIndex: 1001,
        }}
      >
        <div style={{ marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
          🎨 3D Mode Active
        </div>
        <div style={{ marginBottom: "8px", fontSize: "12px" }}>
          Select shape and click on grid
        </div>
        <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log("Box selected");
              setSelectedShape("box");
            }}
            style={{
              padding: "8px",
              background: selectedShape === "box" ? "#6965db" : "#fff",
              color: selectedShape === "box" ? "#fff" : "#000",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            📦 Box
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log("Sphere selected");
              setSelectedShape("sphere");
            }}
            style={{
              padding: "8px",
              background: selectedShape === "sphere" ? "#6965db" : "#fff",
              color: selectedShape === "sphere" ? "#fff" : "#000",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ⚪ Sphere
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log("Cone selected");
              setSelectedShape("cone");
            }}
            style={{
              padding: "8px",
              background: selectedShape === "cone" ? "#6965db" : "#fff",
              color: selectedShape === "cone" ? "#fff" : "#000",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            🔺 Cone
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log("Cylinder selected");
              setSelectedShape("cylinder");
            }}
            style={{
              padding: "8px",
              background: selectedShape === "cylinder" ? "#6965db" : "#fff",
              color: selectedShape === "cylinder" ? "#fff" : "#000",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            🥫 Cylinder
          </button>
        </div>
        <div
          style={{
            marginTop: "8px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          🖱️ Drag to rotate<br />
          🔄 Scroll to zoom<br />
          👆 Click grid to add shape
        </div>
      </div>
    </div>
  );
};
