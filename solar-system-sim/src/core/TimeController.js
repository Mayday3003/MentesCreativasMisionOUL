export class TimeController {
    constructor() {
        this.time = 0;
        this.baseSpeed = 0.003;
        this.currentSpeed = this.baseSpeed;
        
        this.targetTime = null;
        this.isFastForwarding = false;
        this.relativeSpeed = 6.0; // 6.5 (Luna) - 0.5 (Tierra)
    }

    update() {
        if (this.isFastForwarding && this.targetTime !== null) {
            const remaining = this.targetTime - this.time;
            
            if (remaining <= 0.002) {
                this.time = this.targetTime;
                this.isFastForwarding = false;
                this.targetTime = null;
                this.currentSpeed = this.baseSpeed;
            } else {
                // Curva de aceleración y frenado suave (Ease-out)
                const fastSpeed = Math.min(0.06, Math.max(this.baseSpeed, remaining * 0.08));
                this.currentSpeed = fastSpeed;
            }
        } else {
            this.currentSpeed = this.baseSpeed;
        }

        this.time += this.currentSpeed;
        return this.time;
    }

    fastForwardToPhase(targetRelativeAngle) {
        // Normalizar ángulo entre 0 y 2PI
        const twoPi = Math.PI * 2;
        const normalizedTarget = ((targetRelativeAngle % twoPi) + twoPi) % twoPi;
        
        // Calcular el ángulo relativo actual
        const currentRelative = ((this.time * this.relativeSpeed) % twoPi + twoPi) % twoPi;
        
        let deltaAngle = normalizedTarget - currentRelative;
        if (deltaAngle <= 0.05) {
            deltaAngle += twoPi; // Siempre avanzar hacia adelante en el tiempo
        }

        const deltaTime = deltaAngle / this.relativeSpeed;
        this.targetTime = this.time + deltaTime;
        this.isFastForwarding = true;
    }
}
