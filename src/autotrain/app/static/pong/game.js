/**
 * Classic Pong Game Implementation
 * Features: Canvas-based rendering, mouse/keyboard controls, AI opponent, collision detection
 */

class PongGame {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('pong-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game state
        this.gameRunning = false;
        this.gameStarted = false;
        
        // Game dimensions
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Paddle properties
        this.paddleWidth = 10;
        this.paddleHeight = 80;
        this.paddleSpeed = 6;
        
        // Ball properties
        this.ballSize = 8;
        this.ballSpeed = 4;
        this.ballSpeedIncrement = 0.2;
        this.maxBallSpeed = 12;
        
        // Initialize game objects
        this.initGameObjects();
        
        // Input handling
        this.keys = {};
        this.mouseY = this.height / 2;
        
        // Score
        this.playerScore = 0;
        this.computerScore = 0;
        
        // Bind event listeners
        this.bindEvents();
        
        // Start rendering
        this.render();
    }
    
    initGameObjects() {
        // Player paddle (left)
        this.playerPaddle = {
            x: 20,
            y: this.height / 2 - this.paddleHeight / 2,
            width: this.paddleWidth,
            height: this.paddleHeight,
            speed: this.paddleSpeed
        };
        
        // Computer paddle (right)
        this.computerPaddle = {
            x: this.width - 30,
            y: this.height / 2 - this.paddleHeight / 2,
            width: this.paddleWidth,
            height: this.paddleHeight,
            speed: this.paddleSpeed * 0.7 // Slightly slower for fair play
        };
        
        // Ball
        this.resetBall();
    }
    
    resetBall() {
        this.ball = {
            x: this.width / 2,
            y: this.height / 2,
            radius: this.ballSize,
            velocityX: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
            velocityY: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
            speed: this.ballSpeed
        };
    }
    
    bindEvents() {
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.gameStarted) {
                    this.startGame();
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseY = e.clientY - rect.top;
        });
        
        // Touch events for mobile
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            this.mouseY = e.touches[0].clientY - rect.top;
        });
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    startGame() {
        this.gameStarted = true;
        this.gameRunning = true;
        this.hideOverlay();
        this.resetBall();
    }
    
    hideOverlay() {
        const overlay = document.getElementById('game-overlay');
        overlay.classList.add('hidden');
    }
    
    showOverlay() {
        const overlay = document.getElementById('game-overlay');
        overlay.classList.remove('hidden');
    }
    
    update() {
        if (!this.gameRunning) return;
        
        // Update player paddle
        this.updatePlayerPaddle();
        
        // Update computer paddle (AI)
        this.updateComputerPaddle();
        
        // Update ball
        this.updateBall();
        
        // Check collisions
        this.checkCollisions();
        
        // Check scoring
        this.checkScoring();
    }
    
    updatePlayerPaddle() {
        // Mouse control
        const targetY = this.mouseY - this.paddleHeight / 2;
        const currentY = this.playerPaddle.y;
        const diff = targetY - currentY;
        
        // Smooth movement towards mouse position
        if (Math.abs(diff) > 2) {
            this.playerPaddle.y += diff * 0.15;
        }
        
        // Keyboard control (arrow keys)
        if (this.keys['ArrowUp']) {
            this.playerPaddle.y -= this.playerPaddle.speed;
        }
        if (this.keys['ArrowDown']) {
            this.playerPaddle.y += this.playerPaddle.speed;
        }
        
        // Keep paddle within bounds
        this.playerPaddle.y = Math.max(0, Math.min(this.height - this.paddleHeight, this.playerPaddle.y));
    }
    
    updateComputerPaddle() {
        // Simple AI: follow the ball's Y position
        const ballCenterY = this.ball.y;
        const paddleCenterY = this.computerPaddle.y + this.paddleHeight / 2;
        
        // Add some prediction and difficulty adjustment
        let targetY = ballCenterY;
        
        // Only move if ball is coming towards computer paddle
        if (this.ball.velocityX > 0) {
            // Predict where ball will be
            const timeToReach = (this.computerPaddle.x - this.ball.x) / this.ball.velocityX;
            const predictedY = this.ball.y + (this.ball.velocityY * timeToReach);
            targetY = predictedY;
        }
        
        // Move towards target position
        if (paddleCenterY < targetY - 10) {
            this.computerPaddle.y += this.computerPaddle.speed;
        } else if (paddleCenterY > targetY + 10) {
            this.computerPaddle.y -= this.computerPaddle.speed;
        }
        
        // Keep paddle within bounds
        this.computerPaddle.y = Math.max(0, Math.min(this.height - this.paddleHeight, this.computerPaddle.y));
    }
    
    updateBall() {
        this.ball.x += this.ball.velocityX;
        this.ball.y += this.ball.velocityY;
    }
    
    checkCollisions() {
        // Ball collision with top and bottom walls
        if (this.ball.y - this.ball.radius <= 0 || this.ball.y + this.ball.radius >= this.height) {
            this.ball.velocityY = -this.ball.velocityY;
            
            // Keep ball within bounds
            if (this.ball.y - this.ball.radius <= 0) {
                this.ball.y = this.ball.radius;
            } else {
                this.ball.y = this.height - this.ball.radius;
            }
        }
        
        // Ball collision with player paddle
        if (this.checkPaddleCollision(this.playerPaddle)) {
            this.handlePaddleHit(this.playerPaddle);
        }
        
        // Ball collision with computer paddle
        if (this.checkPaddleCollision(this.computerPaddle)) {
            this.handlePaddleHit(this.computerPaddle);
        }
    }
    
    checkPaddleCollision(paddle) {
        return (
            this.ball.x - this.ball.radius <= paddle.x + paddle.width &&
            this.ball.x + this.ball.radius >= paddle.x &&
            this.ball.y - this.ball.radius <= paddle.y + paddle.height &&
            this.ball.y + this.ball.radius >= paddle.y
        );
    }
    
    handlePaddleHit(paddle) {
        // Reverse X direction
        this.ball.velocityX = -this.ball.velocityX;
        
        // Add spin based on where ball hit the paddle
        const hitPos = (this.ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2);
        this.ball.velocityY += hitPos * 2;
        
        // Increase ball speed slightly (up to maximum)
        if (this.ball.speed < this.maxBallSpeed) {
            this.ball.speed += this.ballSpeedIncrement;
            const speedMultiplier = this.ball.speed / Math.sqrt(this.ball.velocityX ** 2 + this.ball.velocityY ** 2);
            this.ball.velocityX *= speedMultiplier;
            this.ball.velocityY *= speedMultiplier;
        }
        
        // Ensure ball doesn't get stuck in paddle
        if (paddle === this.playerPaddle) {
            this.ball.x = paddle.x + paddle.width + this.ball.radius;
        } else {
            this.ball.x = paddle.x - this.ball.radius;
        }
    }
    
    checkScoring() {
        // Player scores (ball passed right edge)
        if (this.ball.x + this.ball.radius >= this.width) {
            this.playerScore++;
            this.updateScore();
            this.resetRound();
        }
        
        // Computer scores (ball passed left edge)
        if (this.ball.x - this.ball.radius <= 0) {
            this.computerScore++;
            this.updateScore();
            this.resetRound();
        }
    }
    
    updateScore() {
        document.getElementById('player-score').textContent = this.playerScore;
        document.getElementById('computer-score').textContent = this.computerScore;
    }
    
    resetRound() {
        // Pause briefly before continuing
        this.gameRunning = false;
        
        setTimeout(() => {
            this.resetBall();
            this.gameRunning = true;
        }, 1000);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw center line
        this.drawCenterLine();
        
        // Draw paddles
        this.drawPaddle(this.playerPaddle);
        this.drawPaddle(this.computerPaddle);
        
        // Draw ball
        this.drawBall();
        
        // Update game state
        this.update();
        
        // Continue rendering
        requestAnimationFrame(() => this.render());
    }
    
    drawCenterLine() {
        this.ctx.setLineDash([10, 10]);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.width / 2, 0);
        this.ctx.lineTo(this.width / 2, this.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawPaddle(paddle) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
        
        // Add slight glow effect
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 5;
        this.ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
        this.ctx.shadowBlur = 0;
    }
    
    drawBall() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Add glow effect
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const game = new PongGame();
});

// Handle window resize for responsive design
window.addEventListener('resize', () => {
    // Add any resize logic here if needed
});