export const MagnetoVertexShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
uniform float uTime;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vLocalPosition = position;
    
    // Ondulaciones sutiles de plasma en la magnetocola provocadas por el viento solar
    vec3 pos = position;
    if (pos.z > 2.0) {
        float wave = sin(pos.z * 0.4 - uTime * 3.0) * 0.15;
        pos.x += wave;
        pos.y += wave * 0.5;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const MagnetoFragmentShader = `
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
uniform float uTime;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Efecto Fresnel: los bordes del choque de plasma brillan con alta intensidad
    float fresnel = 1.0 - abs(dot(viewDir, normal));
    fresnel = pow(fresnel, 2.2);

    // Color eléctrico de plasma (Azul Aurora / Cian magnético)
    vec3 plasmaColor = vec3(0.05, 0.65, 1.0);
    vec3 bowShockColor = vec3(0.3, 0.85, 1.0);

    // Brillo más intenso en la zona frontal (Choque en arco / Bow Shock hacia -Z)
    float bowShockFactor = smoothstep(1.0, -4.0, vLocalPosition.z);
    vec3 finalColor = mix(plasmaColor, bowShockColor, bowShockFactor);

    // Desvanecimiento suave hacia el extremo final de la cola (+Z)
    float tailFade = 1.0 - smoothstep(5.0, 32.0, vLocalPosition.z);

    // Ondulación de brillo temporal (viento solar interactuando)
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + vLocalPosition.z * 0.2);

    float alpha = (fresnel * 0.75 + 0.08) * tailFade * pulse;

    gl_FragColor = vec4(finalColor * 1.3, alpha);
}
`;
