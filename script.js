let COLS = 10;
let ROWS = 10;
let CELL_SIZE = 400 / 10; // dynamically calculated

const difficultySelect = document.getElementById('difficultySelect');

let mazeGrid = [];
let aiPath = [];
let humanPos = { x: 0, y: 0 };
let humanPathLength = 0;
let humanPathArray = [];
let isRaceActive = false;
let aiAnimationId = null;
let aiCurrentStep = 0;

// DOM Elements
const generateBtn = document.getElementById('generateBtn');
const startRaceBtn = document.getElementById('startRaceBtn');
const statusMessage = document.getElementById('statusMessage');
const aiCanvas = document.getElementById('aiCanvas');
const aiCtx = aiCanvas.getContext('2d');
const humanCanvas = document.getElementById('humanCanvas');
const humanCtx = humanCanvas.getContext('2d');
const aiStepsEl = document.getElementById('aiSteps');
const humanStepsEl = document.getElementById('humanSteps');
const humanOverlay = document.getElementById('humanOverlay');

const resultsModal = document.getElementById('resultsModal');
const finalAiSteps = document.getElementById('finalAiSteps');
const finalHumanSteps = document.getElementById('finalHumanSteps');
const resultComment = document.getElementById('resultComment');
const playAgainBtn = document.getElementById('playAgainBtn');
const reviewBoardBtn = document.getElementById('reviewBoardBtn');

class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.walls = { top: true, right: true, bottom: true, left: true };
        this.visited = false;
    }
}

function index(x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return -1;
    return x + y * COLS;
}

// 1. Maze Generator (Recursive Backtracking)
function generateMaze() {
    mazeGrid = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            mazeGrid.push(new Cell(x, y));
        }
    }

    let current = mazeGrid[0];
    current.visited = true;
    let stack = [current];

    while (stack.length > 0) {
        let next = getUnvisitedNeighbor(current);
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else {
            current = stack.pop();
        }
    }

    // Upgrade to "Braided" multiple path maze: break extra internal walls
    let wallsToBreak = Math.floor(COLS * ROWS * 0.15); // Add ~15% extra paths
    for (let i = 0; i < wallsToBreak; i++) {
        let rx = Math.floor(Math.random() * (COLS - 1));
        let ry = Math.floor(Math.random() * (ROWS - 1));
        let cellA = mazeGrid[index(rx, ry)];
        if (Math.random() > 0.5) {
            let cellB = mazeGrid[index(rx + 1, ry)];
            if (cellA && cellB) { cellA.walls.right = false; cellB.walls.left = false; }
        } else {
            let cellB = mazeGrid[index(rx, ry + 1)];
            if (cellA && cellB) { cellA.walls.bottom = false; cellB.walls.top = false; }
        }
    }
}

function getUnvisitedNeighbor(cell) {
    let neighbors = [];
    const top = mazeGrid[index(cell.x, cell.y - 1)];
    const right = mazeGrid[index(cell.x + 1, cell.y)];
    const bottom = mazeGrid[index(cell.x, cell.y + 1)];
    const left = mazeGrid[index(cell.x - 1, cell.y)];

    if (top && !top.visited) neighbors.push(top);
    if (right && !right.visited) neighbors.push(right);
    if (bottom && !bottom.visited) neighbors.push(bottom);
    if (left && !left.visited) neighbors.push(left);

    if (neighbors.length > 0) {
        let r = Math.floor(Math.random() * neighbors.length);
        return neighbors[r];
    }
    return undefined;
}

function removeWalls(a, b) {
    const dx = a.x - b.x;
    if (dx === 1) { a.walls.left = false; b.walls.right = false; }
    else if (dx === -1) { a.walls.right = false; b.walls.left = false; }

    const dy = a.y - b.y;
    if (dy === 1) { a.walls.top = false; b.walls.bottom = false; }
    else if (dy === -1) { a.walls.bottom = false; b.walls.top = false; }
}

// 2. Pathfinder (BFS to guarantee absolute shortest path)
function solveAI() {
    const start = mazeGrid[index(0, 0)];
    const target = mazeGrid[index(COLS - 1, ROWS - 1)];
    
    let queue = [{ cell: start, path: [start] }];
    let visitedSet = new Set([index(start.x, start.y)]);

    while (queue.length > 0) {
        let { cell, path } = queue.shift();
        
        if (cell === target) {
            return path; // shortest path
        }

        let neighbors = getAccessibleNeighbors(cell);
        for (let n of neighbors) {
            if (!visitedSet.has(index(n.x, n.y))) {
                visitedSet.add(index(n.x, n.y));
                queue.push({ cell: n, path: [...path, n] });
            }
        }
    }
    return [];
}

function getAccessibleNeighbors(cell) {
    let neighbors = [];
    let x = cell.x, y = cell.y;
    if (!cell.walls.top) neighbors.push(mazeGrid[index(x, y - 1)]);
    if (!cell.walls.right) neighbors.push(mazeGrid[index(x + 1, y)]);
    if (!cell.walls.bottom) neighbors.push(mazeGrid[index(x, y + 1)]);
    if (!cell.walls.left) neighbors.push(mazeGrid[index(x - 1, y)]);
    return neighbors;
}

// 3. Drawing Utilities
function drawMazeAndEntities(ctx, isAiCtx, showAiPath = false, showHumanPath = false) {
    // Clear canvas
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, 400, 400);

    // Draw grid walls
    ctx.strokeStyle = isAiCtx ? 'rgba(255, 0, 60, 0.4)' : 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = 0; i < mazeGrid.length; i++) {
        let cell = mazeGrid[i];
        let px = cell.x * CELL_SIZE;
        let py = cell.y * CELL_SIZE;

        ctx.beginPath();
        if (cell.walls.top) { ctx.moveTo(px, py); ctx.lineTo(px + CELL_SIZE, py); }
        if (cell.walls.right) { ctx.moveTo(px + CELL_SIZE, py); ctx.lineTo(px + CELL_SIZE, py + CELL_SIZE); }
        if (cell.walls.bottom) { ctx.moveTo(px + CELL_SIZE, py + CELL_SIZE); ctx.lineTo(px, py + CELL_SIZE); }
        if (cell.walls.left) { ctx.moveTo(px, py + CELL_SIZE); ctx.lineTo(px, py); }
        ctx.stroke();
    }

    // Draw End Goal
    const goalX = (COLS - 1) * CELL_SIZE + 2;
    const goalY = (ROWS - 1) * CELL_SIZE + 2;
    ctx.fillStyle = '#f7df1e';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f7df1e';
    ctx.fillRect(goalX, goalY, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.shadowBlur = 0; // reset

    // Draw Entity
    if (isAiCtx) {
        // Draw AI Path so far
        if (aiPath.length > 0 && showAiPath) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 0, 60, 1)'; // Solid red
            ctx.shadowBlur = 20; // Shinier!
            ctx.shadowColor = '#ff003c';
            ctx.lineWidth = 4;
            const maxStep = showAiPath ? aiPath.length - 1 : aiCurrentStep;
            for (let i = 0; i <= maxStep; i++) {
                let p = aiPath[i];
                let cx = p.x * CELL_SIZE + CELL_SIZE / 2;
                let cy = p.y * CELL_SIZE + CELL_SIZE / 2;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        }

        // Draw dot (only in review mode)
        if (showAiPath) {
            let curr = aiPath[aiCurrentStep];
            if (curr) {
                ctx.fillStyle = '#ff003c';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff003c';
                ctx.beginPath();
                ctx.arc(curr.x * CELL_SIZE + CELL_SIZE / 2, curr.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    } else {
        // Draw Human Path
        if (humanPathArray.length > 0 && showHumanPath) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(0, 240, 255, 1)'; // Solid blue
            ctx.shadowBlur = 20; // Shinier!
            ctx.shadowColor = '#00f0ff';
            ctx.lineWidth = 4;
            for (let i = 0; i < humanPathArray.length; i++) {
                let p = humanPathArray[i];
                let cx = p.x * CELL_SIZE + CELL_SIZE / 2;
                let cy = p.y * CELL_SIZE + CELL_SIZE / 2;
                if (i === 0) ctx.moveTo(cx, cy);
                else ctx.lineTo(cx, cy);
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        }

        // Draw Human Dot
        ctx.fillStyle = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f0ff';
        ctx.beginPath();
        ctx.arc(humanPos.x * CELL_SIZE + CELL_SIZE / 2, humanPos.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function updateDisplays() {
    drawMazeAndEntities(aiCtx, true, false);
    drawMazeAndEntities(humanCtx, false);
}

// 4. Game Logic & Controllers
difficultySelect.addEventListener('change', () => {
    let val = parseInt(difficultySelect.value);
    COLS = val;
    ROWS = val;
    CELL_SIZE = 400 / val;
    generateBtn.click();
});

generateBtn.addEventListener('click', () => {
    generateMaze();
    humanPos = { x: 0, y: 0 };
    humanPathLength = 0;
    humanPathArray = [{ x: 0, y: 0 }];
    aiPath = solveAI();
    aiCurrentStep = 0;
    isRaceActive = false;
    clearTimeout(aiAnimationId);

    humanStepsEl.innerText = '0';
    aiStepsEl.innerText = '--'; // Hide AI total until race starts
    
    humanOverlay.classList.remove('hidden');
    startRaceBtn.disabled = false;
    statusMessage.innerText = "Maze generated! Press 'Start Race' when you're ready.";
    statusMessage.style.color = '#00f0ff';
    updateDisplays();
});

startRaceBtn.addEventListener('click', () => {
    isRaceActive = true;
    startRaceBtn.disabled = true;
    generateBtn.disabled = true;
    humanOverlay.classList.add('hidden');
    statusMessage.innerText = "RACE IN PROGRESS! Find the goal (yellow square)!";
    statusMessage.style.color = '#ff003c';
    
    // Animate AI
    animateAI();
});

function animateAI() {
    if (!isRaceActive) return;
    if (aiCurrentStep < aiPath.length - 1) {
        aiCurrentStep++;
        aiStepsEl.innerText = aiCurrentStep;
        drawMazeAndEntities(aiCtx, true, false);
        
        let targetDelay = 150; // AI speed in ms
        aiAnimationId = setTimeout(animateAI, targetDelay);
    }
}

// 5. Human Input
window.addEventListener('keydown', (e) => {
    if (!isRaceActive) return;
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"].indexOf(e.key) > -1) {
        e.preventDefault(); // prevent window scroll
    }

    let cell = mazeGrid[index(humanPos.x, humanPos.y)];
    let newX = humanPos.x;
    let newY = humanPos.y;

    if ((e.key === 'ArrowUp' || e.key === 'w') && !cell.walls.top) newY--;
    else if ((e.key === 'ArrowRight' || e.key === 'd') && !cell.walls.right) newX++;
    else if ((e.key === 'ArrowDown' || e.key === 's') && !cell.walls.bottom) newY++;
    else if ((e.key === 'ArrowLeft' || e.key === 'a') && !cell.walls.left) newX--;

    if (newX !== humanPos.x || newY !== humanPos.y) {
        humanPos.x = newX;
        humanPos.y = newY;
        humanPathLength++;
        humanStepsEl.innerText = humanPathLength;
        humanPathArray.push({ x: newX, y: newY });
        
        drawMazeAndEntities(humanCtx, false);

        // Check Win Condition
        if (humanPos.x === COLS - 1 && humanPos.y === ROWS - 1) {
            endRace();
        }
    }
});

function endRace() {
    isRaceActive = false;
    clearTimeout(aiAnimationId);
    
    const optimalLength = aiPath.length - 1; // absolute minimum steps
    finalAiSteps.innerText = optimalLength;
    finalHumanSteps.innerText = humanPathLength;

    if (humanPathLength === optimalLength) {
        resultComment.innerText = "PERFECT RUN! You tied the optimal A* bot route! 🤖🔥";
        resultComment.style.color = "#00f0ff";
    } else if (humanPathLength < aiCurrentStep) {
        // Technically human was faster physically, but AI optimal path is true baseline
        resultComment.innerText = `You finished before the AI finished thinking! But you took ${humanPathLength - optimalLength} extra steps than necessary.`;
        resultComment.style.color = "#f7df1e";
    } else {
        resultComment.innerText = `You made it! But you took ${humanPathLength - optimalLength} more steps than the AI's perfect path. Keep practicing!`;
        resultComment.style.color = "#ff003c";
    }

    drawMazeAndEntities(aiCtx, true, true); // Reveal AI path once finished
    drawMazeAndEntities(humanCtx, false, false, true); // Reveal Human path once finished
    resultsModal.classList.remove('hidden');
    generateBtn.disabled = false;
}

playAgainBtn.addEventListener('click', () => {
    resultsModal.classList.add('hidden');
    generateBtn.click(); // Automatically generate a new one
});

reviewBoardBtn.addEventListener('click', () => {
    resultsModal.classList.add('hidden');
    // Hide modal to let human view the paths
});

// Initial draw of empty board
drawMazeAndEntities(aiCtx, true);
drawMazeAndEntities(humanCtx, false);
