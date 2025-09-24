    class CompactBreathingTimer {
      constructor() {
        this.squarePhases = ["Inhale", "Hold", "Exhale", "Hold"];
        this.trianglePhases = ["Inhale", "Hold", "Exhale"];
        this.currentPhase = 0;
        this.seconds = 0;
        this.rounds = 0;
        this.running = false;
        this.paused = false;
        this.wakeLock = null;
        this.timerInterval = null;
        this.statsInterval = null;
        this.startTime = null;
        this.pausedDuration = 0;

        this.legsCompleted = 0;        // how many legs (phases) have finished
        this.warningTimeouts = [];     // stores timeout ids for scheduled beeps
        this.finalStopTimeout = null;  // timeout id for the final stop        

        this.path = document.getElementById("shapePath");
        this.svg = document.getElementById("shapeSvg");
        this.pathLength = 0;
        this.speed = 200; // px/sec for smooth motion
        this.duration = 0;        

        this.exerciseType = parseInt(document.getElementById("typeSelect").value);
        this.intervals = [];
        this.currentIntervalIndex = 0;

        this.initElements();
        this.bindEvents();
        this.addInterval(5, 4);
        this.setupShape();
        this.updateStats();
        this.updateSettingsDisplay();
        
      }

      initElements() {
        this.elements = {
          startBtn: document.getElementById("startButton"),
          pauseBtn: document.getElementById("pauseButton"),
          stopBtn: document.getElementById("stopButton"),
          resetBtn: document.getElementById("resetButton"),
          typeSelect: document.getElementById("typeSelect"),
          //shapeBorder: document.getElementById("shapeBorder"),
          movingBall: document.getElementById("movingBall"),
          phaseText: document.getElementById("phaseText"),
          timeValue: document.getElementById("timeValue"),
          roundsValue: document.getElementById("roundsValue"),
          intervalValue: document.getElementById("intervalValue"),
          settingsToggle: document.getElementById("settingsToggle"),
          closeSettings: document.getElementById("closeSettings"),
          settingsPanel: document.getElementById("settingsPanel"),
          intervalList: document.getElementById("intervalList"),
          addIntervalBtn: document.getElementById("addIntervalBtn"),
          saveSettingsBtn: document.getElementById('saveSettingsBtn'),
          currentType: document.getElementById("currentType"),
          currentIntervals: document.getElementById("currentIntervals"),
          totalRounds: document.getElementById("totalRounds")
          
        };
      }

      bindEvents() {
        this.elements.startBtn.onclick = () => this.handleStart();
        this.elements.pauseBtn.onclick = () => this.handlePause();
        this.elements.stopBtn.onclick = () => this.handleStop();
        this.elements.resetBtn.onclick = () => this.handleReset();

        this.elements.typeSelect.onchange = (e) => {
          this.exerciseType = parseInt(e.target.value);
          this.setupShape();
          this.updateSettingsDisplay();
        };

        const overlay = document.getElementById("overlay");
        
        this.elements.settingsToggle.onclick = () => {
          this.elements.settingsPanel.classList.add("open");
          overlay.classList.add("active");
        };

        this.elements.closeSettings.onclick = () => {
          this.elements.settingsPanel.classList.remove("open");
          overlay.classList.remove("active");
        };

        overlay.onclick = () => {
          this.elements.settingsPanel.classList.remove("open");
          overlay.classList.remove("active");
        };

        this.elements.addIntervalBtn.onclick = () => {
          this.addInterval(5, 4);
        };

        this.elements.saveSettingsBtn.onclick = () => {
          this.saveSettings();
        };        

        // Close settings on escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.elements.settingsPanel.classList.contains('open')) {
            this.elements.settingsPanel.classList.remove("open");
            overlay.classList.remove("active");
          }
        });
      }

      loadSettings() {
        const savedType = localStorage.getItem('breathingType');
        const savedIntervals = JSON.parse(localStorage.getItem('intervals') || '[]');

        if (savedType) {
          typeSelect.value = savedType;
          this.elements.typeSelect.dispatchEvent(new Event("change"));
        }

        intervalList.innerHTML = '';
        savedIntervals.forEach(interval => {
          this.addInterval(interval.rounds, interval.duration);
        });
      }      

      // clear any pending scheduled warnings / stop
      clearAllWarnings() {
        this.warningTimeouts.forEach(id => clearTimeout(id));
        this.warningTimeouts = [];
        if (this.finalStopTimeout) {
          clearTimeout(this.finalStopTimeout);
          this.finalStopTimeout = null;
        }
      }
      
      // schedule warnings for upcoming leg (nextLegIndex is 0-based index of the upcoming leg)
      scheduleWarningsForUpcomingLeg(nextLegIndex, secondsForLeg) {
        if (!this.intervals || this.intervals.length === 0) return;
        const legsPerRound = this.exerciseType;

        let cum = 0, intervalIndex = 0;
        for (let i = 0; i < this.intervals.length; i++) {
          const legsInThisInterval = (this.intervals[i].rounds || 0) * legsPerRound;
          cum += legsInThisInterval;
          if (nextLegIndex <= cum - 1) {
            intervalIndex = i;
            break;
          }
        }

        const totalLegsTillInterval = this.intervals
          .slice(0, intervalIndex + 1)
          .reduce((s, iv) => s + (iv.rounds || 0) * legsPerRound, 0);

        const totalLegsAll = this.intervals
          .reduce((s, iv) => s + (iv.rounds || 0) * legsPerRound, 0);

        // ✅ Beep 2x before finishing interval
        if (nextLegIndex === totalLegsTillInterval - 1) {
          console.log("Before changing the cycle : "+secondsForLeg);
          setTimeout(() => this.playBeeps(2), Math.max(0, secondsForLeg * 1000 - 1000));
        }

        // ✅ Beep 3x + stop after last leg
        if (nextLegIndex === totalLegsAll - 1) {
          setTimeout(() => this.playBeeps(3), Math.max(0, secondsForLeg * 1000 - 1000));
          setTimeout(() => this.handleStop(), secondsForLeg * 1000);
        }
      }


      addInterval(rounds, seconds) {
        const row = document.createElement("div");
        row.className = "interval-row";
        row.innerHTML = `
          <input type="number" class="input-field rounds-input" value="${rounds}" min="1"/>
          <input type="number" class="input-field seconds-input" value="${seconds}" min="2"/>
          <button class="remove-btn">✕</button>
        `;
        this.elements.intervalList.appendChild(row);

        row.querySelector(".remove-btn").onclick = () => {
          row.remove();
          this.updateIntervals();
        };

        row.querySelectorAll("input").forEach((input) => {
          input.onchange = () => this.updateIntervals();
        });

        this.updateIntervals();
      }

      saveSettings(){
        const breathingType = typeSelect.value;

        const intervals = [];
        document.querySelectorAll('.interval-row').forEach(row => {
          const inputs = row.querySelectorAll('.input-field');
          intervals.push({
            rounds: inputs[0].value,
            duration: inputs[1].value
          });
        });

        localStorage.setItem('breathingType', breathingType);
        localStorage.setItem('intervals', JSON.stringify(intervals));
        alert('Settings saved!');

      }

      updateIntervals() {
        this.intervals = [];
        this.elements.intervalList.querySelectorAll(".interval-row").forEach((row) => {
          const rounds = parseInt(row.querySelector(".rounds-input").value);
          const seconds = parseInt(row.querySelector(".seconds-input").value);
          this.intervals.push({ rounds, seconds });
        });
        this.currentIntervalIndex = 0;
        if (this.intervals.length > 0) {
          this.seconds = this.intervals[0].seconds;
        }
        this.updateSettingsDisplay();
      }

      updateSettingsDisplay() {
        const typeText = this.exerciseType === 3 ? "Triangle" : "Square";
        this.elements.currentType.textContent = typeText;

        const totalRounds = this.intervals.reduce((sum, interval) => sum + interval.rounds, 0);
        this.elements.totalRounds.textContent = totalRounds;

        // ✅ Show all configured intervals under "Intervals"
        const currentIntervalsEl = this.elements.currentIntervals;
        currentIntervalsEl.innerHTML = "";

        if (this.intervals.length > 0) {
          this.intervals.forEach((iv, idx) => {
            const span = document.createElement("span");
            span.textContent = `${iv.rounds}r × ${iv.seconds}s${idx < this.intervals.length - 1 ? ',' : ''}`;

            // ✅ Highlight currently active interval
            if (idx === this.currentIntervalIndex) {
              span.classList.add("active-interval");
            }

            currentIntervalsEl.appendChild(span);
          });
        } else {
          currentIntervalsEl.textContent = "—";
        }
      }



      getCurrentIntervalSeconds() {
        let totalRounds = 0;
        for (let i = 0; i < this.intervals.length; i++) {
          totalRounds += this.intervals[i].rounds;
          if (this.rounds < totalRounds) {
            this.currentIntervalIndex = i;
            return this.intervals[i].seconds;
          }
        }
        return this.intervals[this.intervals.length - 1]?.seconds || 4;
      }

      setupShape() {

        let d = "";
        const w = this.svg.clientWidth;
        const h = this.svg.clientHeight;

        if (this.exerciseType === 3) {
          // Triangle
          d = `M ${w/2},0 L ${w},${h} L 0,${h} Z`;
        } else {
          // Square
          d = `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;
        }

        this.path.setAttribute("d", d);
        this.pathLength = this.path.getTotalLength();

        // adjust duration so speed is constant
        this.duration = (this.pathLength / this.speed) * 1000;

        this.currentPhase = 0;
        this.moveBallSVG(0);
        this.requestWakeLock();
      }      

      moveBallSVG(progress) {
        if (!this.pathLength) return;
        const point = this.path.getPointAtLength(this.pathLength * progress);
        this.elements.movingBall.style.transform =
          `translate(${point.x}px, ${point.y}px) translate(-6px,-6px)`;
      }      

      animateBall() {
        if (!this.running || this.paused) return;

        const phaseFraction = this.currentPhase / this.exerciseType;
        const nextFraction = (this.currentPhase + 1) / this.exerciseType;

        const start = this.pathLength * phaseFraction;
        const end = this.pathLength * nextFraction;
        const length = end - start;

        const duration = this.seconds * 1000;
        const startTime = performance.now();

        const step = (now) => {
          if (!this.running || this.paused) return;

          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);

          const point = this.path.getPointAtLength(start + length * t);
          this.elements.movingBall.style.transform =
            `translate(${point.x}px, ${point.y}px) translate(-6px,-6px)`;

          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            // ✅ Leg finished
            this.legsCompleted++;
            const legsPerRound = this.exerciseType;

            // Schedule warnings/beeps for the upcoming leg
            this.scheduleWarningsForUpcomingLeg(this.legsCompleted, this.seconds);

            // Check for completed round
            if (this.legsCompleted % legsPerRound === 0) {
              this.rounds++;
              this.seconds = this.getCurrentIntervalSeconds();
              this.updateSettingsDisplay();
            }

            // Advance to next phase
            this.currentPhase = (this.currentPhase + 1) % legsPerRound;

            // Beep once at phase change
            this.playBeeps(1);

            // Update UI
            this.updatePhase();
            this.updateStats();

            // ✅ Continue seamlessly with next phase
            if (this.running) {
              this.animateBall();
            }
          }
        };

        requestAnimationFrame(step);
      }

      handleStart() {
        if (this.paused) return this.handleResume();

        this.running = true;
        this.startTime = Date.now();
        this.currentPhase = 0;
        this.rounds = 0;
        this.seconds = this.getCurrentIntervalSeconds();

        console.log("Seconds value is: " + this.seconds);

        this.setupShape();

        this.elements.startBtn.disabled = true;
        this.elements.pauseBtn.disabled = false;
        this.elements.stopBtn.disabled = false;

        // Initial beep to signal start
        this.playBeeps(1);

        // Reset leg counters and clear any previously scheduled warnings
        this.legsCompleted = 0;
        this.clearAllWarnings();

        // Schedule warnings for the very first leg
        this.scheduleWarningsForUpcomingLeg(this.legsCompleted, this.seconds);

        // ✅ Start continuous animation (self-chaining via animateBall)
        this.animateBall();

        // ✅ Start stats refresh only (no animation inside startTimer anymore)
        this.startTimer();

        // Update phase + stats UI
        this.updatePhase();
        this.updateStats();
      }


      handlePause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        this.pausedDuration = Date.now() - this.startTime;
        clearInterval(this.timerInterval);
        clearInterval(this.statsInterval);
        this.clearAllWarnings;
        this.elements.phaseText.textContent = "Paused";
        this.releaseWakeLock();
        this.elements.startBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
      }

      handleResume() {
        this.paused = false;
        this.startTime = Date.now() - this.pausedDuration;
        this.startTimer();
        this.statsInterval = setInterval(() => this.updateStats(), 100);
        this.elements.startBtn.disabled = true;
        this.elements.pauseBtn.disabled = false;
        this.animateBall();
        this.updatePhase();
        this.requestWakeLock();
      }

      handleStop() {
        this.running = false;
        this.paused = false;
        clearInterval(this.timerInterval);
        clearInterval(this.statsInterval);
        this.clearAllWarnings;
        //this.moveBall(0);
        this.elements.startBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
        this.elements.stopBtn.disabled = true;
        this.elements.phaseText.textContent = "Stopped";
        this.currentPhase = 0;
        this.releaseWakeLock();
      }

      handleReset() {
        this.handleStop();
        this.clearAllWarnings;
        this.rounds = 0;
        this.startTime = null;
        this.pausedDuration = 0;
        this.currentPhase = 0;
        this.seconds = this.intervals[0]?.seconds || 4;
        this.setupShape();
        this.updateStats();
        this.elements.phaseText.textContent = "Ready to breathe";
      }

      playBeeps(count) {
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            beep.currentTime = 0; // restart sound from beginning
            beep.play();
          }, i * 150); // 150ms gap for quick "beep-beep"
        }
      } 

      // ✅ Do not clear ALL warnings every leg – only cancel overlapping
      startTimer() {
        // ✅ Only used for stats refresh (not animation driving anymore)
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.updateStats(), 1000);
      }


      updatePhase() {
        const phases = this.exerciseType === 3 ? this.trianglePhases : this.squarePhases;
        this.elements.phaseText.textContent = phases[this.currentPhase];
      }

      updateStats() {
        if (this.startTime && !this.paused) {
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          const minutes = Math.floor(elapsed / 60);
          const seconds = elapsed % 60;
          this.elements.timeValue.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
        }
        this.elements.roundsValue.textContent = this.rounds;
        this.elements.intervalValue.textContent = `${this.seconds}s`;
      }

      async requestWakeLock() {
        try {
          this.wakeLock = await navigator.wakeLock.request("screen");
        } catch {}
      }

      async releaseWakeLock() {
        if (this.wakeLock) {
          await this.wakeLock.release();
          this.wakeLock = null;
        }
      }
}

document.addEventListener("DOMContentLoaded", () => {
  window.beep = document.getElementById("beep");  
  const breathingTimer = new CompactBreathingTimer();
  window.onload = breathingTimer.loadSettings();
});