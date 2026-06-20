// State
let provider = null;
let signer = null;
let userAddress = null;

// DOM Elements
const connectBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const deployForm = document.getElementById('deployForm');
const deployBtn = document.getElementById('deployBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const ownerAddressInput = document.getElementById('ownerAddress');

// Connect Wallet
connectBtn.addEventListener('click', async () => {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('error', '❌ Please install MetaMask or a Web3 wallet');
            return;
        }

        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        // Display wallet info
        walletAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        ownerAddressInput.value = userAddress;
        
        // Get balance
        const balance = await provider.getBalance(userAddress);
        const balanceMintme = ethers.utils.formatEther(balance);
        walletBalance.textContent = parseFloat(balanceMintme).toFixed(4);
        
        walletInfo.style.display = 'block';
        connectBtn.textContent = '✅ Connected';
        connectBtn.disabled = true;
        deployBtn.disabled = false;
        
        showStatus('success', '✅ Wallet connected successfully!');
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // Disconnected
                resetWallet();
            } else {
                userAddress = accounts[0];
                walletAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
                ownerAddressInput.value = userAddress;
                showStatus('success', '✅ Account changed');
            }
        });
        
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('error', `❌ Connection failed: ${error.message}`);
    }
});

function resetWallet() {
    userAddress = null;
    walletInfo.style.display = 'none';
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.disabled = false;
    deployBtn.disabled = true;
    ownerAddressInput.value = '';
    showStatus('info', '🔄 Wallet disconnected');
}

// Deploy Token
deployForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!userAddress) {
        showStatus('error', '❌ Please connect your wallet first');
        return;
    }
    
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
    
    try {
        deployBtn.disabled = true;
        deployBtn.textContent = '⏳ Deploying...';
        showStatus('loading', '⏳ Deploying your token... This may take a moment');
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
            
            // Show result
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <h3>🎉 Token Deployed!</h3>
                <div class="result-item">
                    <span class="result-label">Token:</span>
                    <span class="result-value">${data.token_name} (${data.token_symbol})</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Contract Address:</span>
                    <span class="result-value">${data.contract_address}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Owner:</span>
                    <span class="result-value">${data.owner}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Total Supply:</span>
                    <span class="result-value">${data.total_supply}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">Deployment Cost:</span>
                    <span class="result-value">${data.deployment_cost} MINTME</span>
                </div>
                <a href="${data.explorer_url}" target="_blank" class="explorer-link">
                    🔍 View on Explorer →
                </a>
            `;
            
            // Reset form
            document.getElementById('tokenName').value = '';
            document.getElementById('tokenSymbol').value = '';
            document.getElementById('initialSupply').value = '';
            
        } else {
            throw new Error(data.error || 'Deployment failed');
        }
        
    } catch (error) {
        console.error('Deployment error:', error);
        showStatus('error', `❌ ${error.message}`);
    } finally {
        deployBtn.disabled = false;
        deployBtn.textContent = 'Deploy Token';
    }
});

function showStatus(type, message) {
    statusDiv.className = 'status ' + type;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 10000);
    }
}

// Check if wallet is already connected
window.addEventListener('load', async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                // Auto-connect
                connectBtn.click();
            }
        } catch (error) {
            console.log('Auto-connect skipped');
        }
    }
});
