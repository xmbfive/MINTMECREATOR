// ============================================
// STATE
// ============================================
let provider = null;
let signer = null;
let userAddress = null;
let isDeploying = false;

// ============================================
// DOM ELEMENTS
// ============================================
const connectBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const walletStatus = document.getElementById('walletStatus');
const statusDot = document.getElementById('statusDot');
const deployForm = document.getElementById('deployForm');
const deployBtn = document.getElementById('deployBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const ownerAddressInput = document.getElementById('ownerAddress');
const totalDeployed = document.getElementById('totalDeployed');

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// STATUS MANAGEMENT
// ============================================
function showStatus(type, message) {
    statusDiv.className = 'status ' + type;
    statusDiv.innerHTML = `
        <span class="status-icon">${type === 'loading' ? '⏳' : type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    statusDiv.style.display = 'flex';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 8000);
    }
}

function updateWalletStatus(connected) {
    if (connected) {
        statusDot.className = 'status-dot connected';
        walletStatus.textContent = 'Connected';
    } else {
        statusDot.className = 'status-dot';
        walletStatus.textContent = 'Not Connected';
    }
}

// ============================================
// WALLET CONNECTION
// ============================================
connectBtn.addEventListener('click', async () => {
    try {
        // Check for MetaMask
        if (typeof window.ethereum === 'undefined') {
            showStatus('error', '🦊 Please install MetaMask or a Web3 wallet');
            return;
        }

        // Request accounts
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Update UI
        walletAddress.textContent = formatAddress(userAddress);
        ownerAddressInput.value = userAddress;
        
        // Get balance
        const balance = await provider.getBalance(userAddress);
        const balanceMintme = ethers.utils.formatEther(balance);
        walletBalance.textContent = parseFloat(balanceMintme).toFixed(4);
        
        walletInfo.style.display = 'flex';
        connectBtn.innerHTML = `
            <span class="btn-icon">✅</span>
            <span class="btn-text">Connected</span>
        `;
        connectBtn.disabled = true;
        deployBtn.disabled = false;
        
        updateWalletStatus(true);
        showStatus('success', '✅ Wallet connected successfully!');
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                resetWallet();
            } else {
                userAddress = accounts[0];
                walletAddress.textContent = formatAddress(userAddress);
                ownerAddressInput.value = userAddress;
                showStatus('success', '✅ Account changed');
            }
        });
        
        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
        
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('error', `❌ Connection failed: ${error.message}`);
    }
});

function resetWallet() {
    userAddress = null;
    walletInfo.style.display = 'none';
    connectBtn.innerHTML = `
        <span class="btn-icon">🦊</span>
        <span class="btn-text">Connect Wallet</span>
    `;
    connectBtn.disabled = false;
    deployBtn.disabled = true;
    ownerAddressInput.value = '';
    updateWalletStatus(false);
    showStatus('info', '🔄 Wallet disconnected');
}

// ============================================
// TOKEN DEPLOYMENT
// ============================================
deployForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        showStatus('error', '❌ Please connect your wallet first');
        return;
    }
    
    if (isDeploying) return;
    
    // Get form values
    const tokenName = document.getElementById('tokenName').value.trim();
    const tokenSymbol = document.getElementById('tokenSymbol').value.trim().toUpperCase();
    const initialSupply = document.getElementById('initialSupply').value.trim();
    const ownerAddress = document.getElementById('ownerAddress').value.trim();
    
    // Validate
    if (!tokenName || !tokenSymbol || !initialSupply || !ownerAddress) {
        showStatus('error', '❌ Please fill all fields');
        return;
    }
    
    if (!ethers.utils.isAddress(ownerAddress)) {
        showStatus('error', '❌ Invalid owner address');
        return;
    }
    
    if (tokenName.length < 2) {
        showStatus('error', '❌ Token name must be at least 2 characters');
        return;
    }
    
    if (tokenSymbol.length < 2) {
        showStatus('error', '❌ Token symbol must be at least 2 characters');
        return;
    }
    
    if (parseInt(initialSupply) <= 0) {
        showStatus('error', '❌ Supply must be greater than 0');
        return;
    }
    
    try {
        isDeploying = true;
        deployBtn.disabled = true;
        deployBtn.innerHTML = `
            <span class="spinner"></span>
            <span class="btn-text">Deploying...</span>
        `;
        
        showStatus('loading', '⏳ Deploying your token... This may take up to 30 seconds');
        resultDiv.style.display = 'none';
        
        // Prepare request
        const requestData = {
            token_name: tokenName,
            token_symbol: tokenSymbol,
            initial_supply: parseInt(initialSupply),
            owner_address: ownerAddress
        };
        
        // Send to backend
        const response = await fetch('/api/deploy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Deployment failed');
        }
        
        if (data.success) {
            showStatus('success', '✅ Token deployed successfully!');
            
            // Update deployed count
            const currentCount = parseInt(totalDeployed.textContent.replace(/,/g, ''));
            totalDeployed.textContent = formatNumber(currentCount + 1);
            
            // Show result
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <h3>🎉 Token Deployed Successfully!</h3>
                <div class="result-item">
                    <span class="result-label">Token</span>
                    <span class="result-value">${data.token_name} (${data.token_symbol})</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Contract Address</span>
                    <span class="result-value mono">${data.contract_address}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Owner</span>
                    <span class="result-value mono">${formatAddress(data.owner)}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Total Supply</span>
                    <span class="result-value">${formatNumber(data.total_supply)}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Deployment Cost</span>
                    <span class="result-value success-text">${formatNumber(data.deployment_cost)} MINTME</span>
                </div>
                <a href="${data.explorer_url}" target="_blank" class="explorer-link">
                    🔍 View on MintMe Explorer →
                </a>
            `;
            
            // Reset form
            document.getElementById('tokenName').value = '';
            document.getElementById('tokenSymbol').value = '';
            document.getElementById('initialSupply').value = '';
            
            // Trigger confetti effect
            createConfetti();
            
        } else {
            throw new Error(data.error || 'Deployment failed');
        }
        
    } catch (error) {
        console.error('Deployment error:', error);
        showStatus('error', `❌ ${error.message}`);
    } finally {
        isDeploying = false;
        deployBtn.disabled = false;
        deployBtn.innerHTML = `
            <span class="btn-icon">⚡</span>
            <span class="btn-text">Deploy Token</span>
            <span class="btn-subtext">4,000 MINTME</span>
        `;
    }
});

// ============================================
// CONFETTI EFFECT
// ============================================
function createConfetti() {
    const colors = ['#6C5CE7', '#A29BFE', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: fixed;
            width: ${Math.random() * 10 + 4}px;
            height: ${Math.random() * 10 + 4}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            left: ${Math.random() * 100}%;
            top: -20px;
            pointer-events: none;
            z-index: 9999;
            opacity: 1;
            transform: rotate(${Math.random() * 360}deg);
            animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
        `;
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, 4000);
    }
}

// Add confetti animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes confettiFall {
        0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg) scale(0);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styleSheet);

// ============================================
// AUTO-CONNECT
// ============================================
window.addEventListener('load', async () => {
    // Simulate total deployed count
    totalDeployed.textContent = formatNumber(1247);
    
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectBtn.click();
            }
        } catch (error) {
            console.log('Auto-connect skipped');
        }
    }
});

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to deploy
    if (e.ctrlKey && e.key === 'Enter') {
        deployForm.dispatchEvent(new Event('submit'));
    }
});
