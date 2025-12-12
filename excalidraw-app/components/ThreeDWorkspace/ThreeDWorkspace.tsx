import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import styles from "./ThreeDWorkspace.module.scss";

type SolidType = "cube" | "sphere" | "cylinder" | "cone";
type InteractionMode = "camera" | "drag";

type Vector3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

type Solid = {
  readonly id: string;
  readonly label: string;
  readonly type: SolidType;
  readonly color: string;
  readonly size: number;
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly metalness: number;
  readonly roughness: number;
};

const TYPE_LABELS: Record<SolidType, string> = {
  cube: "Cube",
  sphere: "Sphere",
  cylinder: "Cylinder",
  cone: "Cone",
};

const INITIAL_SOLID: Omit<Solid, "id" | "label" | "type"> = {
  color: "#38bdf8",
  size: 1,
  position: { x: 0, y: 0.5, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  metalness: 0.25,
  roughness: 0.55,
};

const SOLID_BASE_HEIGHT: Record<SolidType, number> = {
  cube: 0.5,
  sphere: 0.5,
  cylinder: 0.5,
  cone: 0.75,
};

const generateSolidId = () =>
  `solid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const degToRad = THREE.MathUtils.degToRad;

const createSolidMesh = (solid: Solid) => {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(solid.color),
    metalness: solid.metalness,
    roughness: solid.roughness,
  });

  const geometry = (() => {
    switch (solid.type) {
      case "sphere":
        return new THREE.SphereGeometry(0.5, 48, 32);
      case "cylinder":
        return new THREE.CylinderGeometry(0.5, 0.5, 1, 48);
      case "cone":
        return new THREE.ConeGeometry(0.5, 1, 48);
      case "cube":
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  })();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const disposeMesh = (mesh: THREE.Mesh) => {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
  } else {
    material.dispose();
  }
};

export const ThreeDWorkspace = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const solidMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragIntersectionRef = useRef(new THREE.Vector3());
  const dragStateRef = useRef<{ solidId: string; y: number } | null>(null);
  const solidsRef = useRef<Solid[]>([]);

  const solidCountersRef = useRef<Record<SolidType, number>>({
    cube: 0,
    sphere: 0,
    cylinder: 0,
    cone: 0,
  });

  const [solids, setSolids] = useState<Solid[]>([]);
  const [selectedSolidId, setSelectedSolidId] = useState<string | null>(null);
  const [interactionTarget, setInteractionTarget] =
    useState<HTMLCanvasElement | null>(null);
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("camera");

  const selectedSolid = useMemo(
    () => solids.find((solid) => solid.id === selectedSolidId) ?? null,
    [selectedSolidId, solids],
  );

  useEffect(() => {
    solidsRef.current = solids;
  }, [solids]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617");
    scene.fog = new THREE.Fog("#020617", 40, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    setInteractionTarget(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(12, 12, 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(10, 15, 8);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    scene.add(directional);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.05,
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    const grid = new THREE.GridHelper(40, 40, 0x38bdf8, 0x1f2937);
    grid.position.y = 0.01;
    scene.add(grid);

    const axesHelper = new THREE.AxesHelper(4);
    axesHelper.position.set(0, 0.02, 0);
    scene.add(axesHelper);

    const resize = () => {
      if (!container || !renderer || !camera) {
        return;
      }
      const { clientWidth, clientHeight } = container;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(container);
    window.addEventListener("resize", resize);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current) {
      return;
    }
    controlsRef.current.enabled = interactionMode === "camera";
  }, [interactionMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    const meshMap = solidMeshesRef.current;
    const staleIds = new Set(meshMap.keys());

    solids.forEach((solid) => {
      let mesh = meshMap.get(solid.id);
      if (!mesh) {
        mesh = createSolidMesh(solid);
        mesh.userData.solidId = solid.id;
        meshMap.set(solid.id, mesh);
        scene.add(mesh);
      }

      mesh.position.set(solid.position.x, solid.position.y, solid.position.z);
      mesh.rotation.set(
        degToRad(solid.rotation.x),
        degToRad(solid.rotation.y),
        degToRad(solid.rotation.z),
      );
      mesh.scale.setScalar(solid.size);

      const material = mesh.material;
      if (
        !Array.isArray(material) &&
        material instanceof THREE.MeshStandardMaterial
      ) {
        material.color.set(solid.color);
        material.metalness = solid.metalness;
        material.roughness = solid.roughness;
      }

      staleIds.delete(solid.id);
    });

    staleIds.forEach((id) => {
      const mesh = meshMap.get(id);
      if (!mesh) {
        return;
      }
      scene.remove(mesh);
      disposeMesh(mesh);
      meshMap.delete(id);
    });
  }, [solids]);

  const addSolid = (type: SolidType) => {
    solidCountersRef.current[type] += 1;
    const defaultPosition = { x: 0, y: SOLID_BASE_HEIGHT[type], z: 0 };
    const newSolid: Solid = {
      ...INITIAL_SOLID,
      type,
      id: generateSolidId(),
      label: `${TYPE_LABELS[type]} ${solidCountersRef.current[type]}`,
      position: defaultPosition,
    };
    setSolids((prev) => [...prev, newSolid]);
    setSelectedSolidId(newSolid.id);
  };

  const updateSolidPosition = useCallback(
    (solidId: string, position: Vector3) => {
      setSolids((prev) =>
        prev.map((solid) =>
          solid.id === solidId ? { ...solid, position } : solid,
        ),
      );
    },
    [],
  );

  const updateSolid = (updater: (solid: Solid) => Solid) => {
    setSolids((prev) =>
      prev.map((solid) =>
        solid.id === selectedSolidId ? updater(solid) : solid,
      ),
    );
  };

  const updateVector = (
    key: "position" | "rotation",
    axis: keyof Vector3,
    value: number,
  ) => {
    if (!selectedSolid) {
      return;
    }
    updateSolid((solid) => ({
      ...solid,
      [key]: {
        ...solid[key],
        [axis]: value,
      },
    }));
  };

  const updateScalar = (
    key: keyof Pick<Solid, "size" | "metalness" | "roughness">,
    value: number,
  ) => {
    if (!selectedSolid) {
      return;
    }
    updateSolid((solid) => ({
      ...solid,
      [key]: value,
    }));
  };

  const updateColor = (color: string) => {
    if (!selectedSolid) {
      return;
    }
    updateSolid((solid) => ({
      ...solid,
      color,
    }));
  };

  const removeSelectedSolid = () => {
    if (!selectedSolid) {
      return;
    }
    setSolids((prev) => {
      const filtered = prev.filter((solid) => solid.id !== selectedSolid.id);
      if (selectedSolidId === selectedSolid.id) {
        const fallback = filtered[filtered.length - 1]?.id ?? null;
        setSelectedSolidId(fallback);
      }
      return filtered;
    });
  };

  const clearScene = () => {
    setSolids([]);
    setSelectedSolidId(null);
  };

  const resetCamera = () => {
    cameraRef.current?.position.set(12, 12, 12);
    controlsRef.current?.target.set(0, 0, 0);
    controlsRef.current?.update();
  };

  useEffect(() => {
    const domElement = interactionTarget;
    if (!domElement || interactionMode !== "drag") {
      dragStateRef.current = null;
      return;
    }

    const updatePointer = (event: PointerEvent) => {
      const rect = domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const camera = cameraRef.current;
      if (!camera) {
        return;
      }
      updatePointer(event);
      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(pointerRef.current, camera);
      const meshes = Array.from(solidMeshesRef.current.values());
      if (!meshes.length) {
        dragStateRef.current = null;
        return;
      }
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) {
        dragStateRef.current = null;
        return;
      }
      const mesh = hit.object as THREE.Mesh;
      const solidId = mesh.userData.solidId as string | undefined;
      if (!solidId) {
        dragStateRef.current = null;
        return;
      }
      const solid = solidsRef.current.find((item) => item.id === solidId);
      if (!solid) {
        dragStateRef.current = null;
        return;
      }
      dragStateRef.current = { solidId, y: solid.position.y };
      setSelectedSolidId(solidId);
      domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      const camera = cameraRef.current;
      if (!dragState || !camera) {
        return;
      }
      updatePointer(event);
      const raycaster = raycasterRef.current;
      const plane = dragPlaneRef.current;
      const intersection = dragIntersectionRef.current;
      raycaster.setFromCamera(pointerRef.current, camera);
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        updateSolidPosition(dragState.solidId, {
          x: intersection.x,
          y: dragState.y,
          z: intersection.z,
        });
      }
    };

    const stopDragging = (event: PointerEvent) => {
      if (domElement.hasPointerCapture(event.pointerId)) {
        domElement.releasePointerCapture(event.pointerId);
      }
      dragStateRef.current = null;
    };

    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointerup", stopDragging);
    domElement.addEventListener("pointerleave", stopDragging);

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointerup", stopDragging);
      domElement.removeEventListener("pointerleave", stopDragging);
    };
  }, [interactionMode, interactionTarget, updateSolidPosition]);

  const renderNumericInput = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    options?: { step?: number; min?: number; max?: number },
  ) => (
    <label className={styles.label}>
      <span>{label}</span>
      <input
        type="number"
        className={styles.numberInput}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        step={options?.step ?? 0.1}
        min={options?.min}
        max={options?.max}
      />
    </label>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarSection}>
          <span className={styles.toolbarLabel}>Solids</span>
          {(Object.keys(TYPE_LABELS) as SolidType[]).map((type) => (
            <button
              type="button"
              key={type}
              className={styles.button}
              onClick={() => addSolid(type)}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        <div className={styles.toolbarSection}>
          <span className={styles.toolbarLabel}>Camera</span>
          <button type="button" className={styles.button} onClick={resetCamera}>
            Reset view
          </button>
        </div>
        <div className={styles.toolbarSection}>
          <span className={styles.toolbarLabel}>Interaction</span>
          <button
            type="button"
            className={clsx(styles.button, {
              [styles.buttonActive]: interactionMode === "camera",
            })}
            onClick={() => setInteractionMode("camera")}
          >
            Camera
          </button>
          <button
            type="button"
            className={clsx(styles.button, {
              [styles.buttonActive]: interactionMode === "drag",
            })}
            onClick={() => setInteractionMode("drag")}
          >
            Drag
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.viewport}>
          <div ref={viewportRef} className={styles.canvas} />
        </div>
        <aside className={styles.sidebar}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Scene objects</p>
            <div className={styles.elementList}>
              {solids.length === 0 && (
                <p className={styles.emptyState}>Add a solid to get started.</p>
              )}
              {solids.map((solid) => (
                <button
                  key={solid.id}
                  type="button"
                  className={clsx(styles.elementRow, {
                    [styles.elementRowActive]: solid.id === selectedSolidId,
                  })}
                  onClick={() => setSelectedSolidId(solid.id)}
                >
                  <span>{solid.label}</span>
                  <span>{solid.type}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Properties</p>
            {!selectedSolid && (
              <p className={styles.emptyState}>
                Select a solid to edit its properties.
              </p>
            )}
            {selectedSolid && (
              <>
                <div className={styles.propertyGrid}>
                  {renderNumericInput(
                    "Pos X",
                    selectedSolid.position.x,
                    (value) => updateVector("position", "x", value),
                  )}
                  {renderNumericInput(
                    "Pos Y",
                    selectedSolid.position.y,
                    (value) => updateVector("position", "y", value),
                  )}
                  {renderNumericInput(
                    "Pos Z",
                    selectedSolid.position.z,
                    (value) => updateVector("position", "z", value),
                  )}
                </div>
                <div className={styles.propertyGrid}>
                  {renderNumericInput(
                    "Rot X",
                    selectedSolid.rotation.x,
                    (value) => updateVector("rotation", "x", value),
                  )}
                  {renderNumericInput(
                    "Rot Y",
                    selectedSolid.rotation.y,
                    (value) => updateVector("rotation", "y", value),
                  )}
                  {renderNumericInput(
                    "Rot Z",
                    selectedSolid.rotation.z,
                    (value) => updateVector("rotation", "z", value),
                  )}
                </div>
                <div className={styles.section}>
                  <label className={styles.label}>
                    <span>Color</span>
                    <input
                      type="color"
                      className={styles.colorInput}
                      value={selectedSolid.color}
                      onChange={(event) => updateColor(event.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    <span>Size</span>
                    <input
                      type="range"
                      min={0.4}
                      max={3}
                      step={0.05}
                      className={styles.rangeInput}
                      value={selectedSolid.size}
                      onChange={(event) =>
                        updateScalar("size", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    <span>Metalness</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      className={styles.rangeInput}
                      value={selectedSolid.metalness}
                      onChange={(event) =>
                        updateScalar("metalness", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.label}>
                    <span>Roughness</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      className={styles.rangeInput}
                      value={selectedSolid.roughness}
                      onChange={(event) =>
                        updateScalar("roughness", Number(event.target.value))
                      }
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {selectedSolid && (
            <div className={styles.dangerZone}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={removeSelectedSolid}
              >
                Remove selected solid
              </button>
            </div>
          )}

          {solids.length > 0 && (
            <div className={styles.dangerZone}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={clearScene}
              >
                Clear scene
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
