export class TimeController {
    constructor() {
        this.time = 0;
        this.baseSpeed = 0.003;
        this.speedMultiplier = 1.0;
        this.currentSpeed = this.baseSpeed;
        
        this.isPaused = false;
        this.targetTime = null;
        this.isFastForwarding = false;
        this.autoPauseOnArrival = false;
        this.relativeSpeed = 6.0; // 6.5 (Luna) - 0.5 (Tierra)

        // Callback para notificar a la UI de eventos de pausa automática
        this.onPauseChanged = null;
    }

    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = Math.max(0, Math.min(10, parseFloat(multiplier)));
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.onPauseChanged) this.onPauseChanged(this.isPaused);
        return this.isPaused;
    }

    setPaused(paused) {
        this.isPaused = paused;
        if (this.onPauseChanged) this.onPauseChanged(this.isPaused);
    }

    update() {
        if (this.isFastForwarding && this.targetTime !== null) {
            const remaining = this.targetTime - this.time;
            
            if (remaining <= 0.002) {
                // Llegamos con precisión a la fase lunar
                this.time = this.targetTime;
                this.isFastForwarding = false;
                this.targetTime = null;
                
                // Si se solicitó pausar automáticamente al llegar a la fase
                if (this.autoPauseOnArrival) {
                    this.isPaused = true;
                    this.autoPauseOnArrival = false;
                    if (this.onPauseChanged) this.onPauseChanged(true);
                }
                this.currentSpeed = 0;
            } else {
                // Curva de aceleración cinematográfica y frenado suave
                const fastSpeed = Math.min(0.06, Math.max(this.baseSpeed, remaining * 0.08));
                this.currentSpeed = fastSpeed;
                this.time += this.currentSpeed;
            }
        } else {
            if (this.isPaused) {
                this.currentSpeed = 0;
            } else {
                this.currentSpeed = this.baseSpeed * this.speedMultiplier;
                this.time += this.currentSpeed;
            }
        }

        return this.time;
    }

    fastForwardToPhase(targetRelativeAngle, autoPause = true) {
        const twoPi = Math.PI * 2;
        const normalizedTarget = ((targetRelativeAngle % twoPi) + twoPi) % twoPi;
        const currentRelative = ((this.time * this.relativeSpeed) % twoPi + twoPi) % twoPi;
        
        let deltaAngle = normalizedTarget - currentRelative;
        if (deltaAngle <= 0.05) {
            deltaAngle += twoPi;
        }

        const deltaTime = deltaAngle / this.relativeSpeed;
        this.targetTime = this.time + deltaTime;
        this.isFastForwarding = true;
        this.autoPauseOnArrival = autoPause;
        this.isPaused = false; // Asegura que corra hasta llegar al punto
        if (this.onPauseChanged) this.onPauseChanged(false);
    }
}
