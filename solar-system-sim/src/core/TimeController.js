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
        
        // Velocidad orbital de la Tierra (0.5) y de la Luna (6.5)
        this.earthOrbitalSpeed = 0.5;
        this.moonOrbitalSpeed = 6.5;
        // Velocidad angular sinódica relativa:
        this.synodicSpeed = this.moonOrbitalSpeed - this.earthOrbitalSpeed; // 6.0 rad/s

        // Callback para notificar a la UI de eventos de pausa
        this.onPauseChanged = null;
        this.onPhaseArrival = null;
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
            
            if (remaining <= 0.0015) {
                // Llegamos con precisión milimétrica a la geometría de la fase lunar
                this.time = this.targetTime;
                this.isFastForwarding = false;
                this.targetTime = null;
                
                // Pausa automática estricta al alcanzar la fase solicitada
                if (this.autoPauseOnArrival) {
                    this.isPaused = true;
                    this.autoPauseOnArrival = false;
                    if (this.onPauseChanged) this.onPauseChanged(true);
                }
                if (this.onPhaseArrival) this.onPhaseArrival();
                this.currentSpeed = 0;
            } else {
                // Curva de aceleración cinematográfica y frenado progresivo (Ease-out)
                const fastSpeed = Math.min(0.065, Math.max(this.baseSpeed, remaining * 0.12));
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

    /**
     * Calcula la geometría orbital sinódica exacta:
     * El ángulo de fase psi mide el ángulo entre el vector Tierra->Luna y el vector Tierra->Sol:
     * - Luna Nueva (0° / 0 rad): Luna situada exactamente entre la Tierra y el Sol.
     * - Cuarto Creciente (90° / PI/2 rad): Cuadratura oriental (la Luna está a 90° adelante).
     * - Luna Llena (180° / PI rad): Oposición astronómica (la Tierra está exactamente entre el Sol y la Luna).
     * - Cuarto Menguante (270° / 3PI/2 rad): Cuadratura occidental (la Luna está a 270°).
     *
     * Dado que:
     * theta_tierra(t) = w_e * t
     * theta_luna(t) = w_m * t
     * Vector Tierra->Sol apunta en ángulo: theta_tierra + PI
     * Vector Tierra->Luna apunta en ángulo: theta_luna
     * El ángulo de elongación/fase sinódica respecto al Sol es:
     * psi(t) = theta_luna - (theta_tierra + PI) = (w_m - w_e)*t - PI = (w_syn * t) - PI (mod 2*PI)
     */
    fastForwardToPhase(targetPhaseAngle, autoPause = true) {
        const twoPi = Math.PI * 2;
        const normalizedTarget = ((targetPhaseAngle % twoPi) + twoPi) % twoPi;
        
        // Fase actual en el instante t:
        // En psi = 0 (Luna Nueva), queremos que theta_luna = theta_tierra + PI (vector hacia el Sol)
        // psi(t) = ((w_syn * t) - PI) mod 2*PI
        const currentPhase = (((this.synodicSpeed * this.time) - Math.PI) % twoPi + twoPi) % twoPi;
        
        let deltaAngle = normalizedTarget - currentPhase;
        if (deltaAngle <= 0.02) {
            deltaAngle += twoPi; // Avanzar hacia adelante en el tiempo orbital
        }

        const deltaTime = deltaAngle / this.synodicSpeed;
        this.targetTime = this.time + deltaTime;
        this.isFastForwarding = true;
        this.autoPauseOnArrival = autoPause;
        this.isPaused = false; // Reanudar temporalmente para el viaje acelerado
        if (this.onPauseChanged) this.onPauseChanged(false);
    }
}
