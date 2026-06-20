#!/usr/bin/env python3
"""
MintMe Token Deployer API - Serverless
"""

import os
import json
import time
from web3 import Web3
from eth_account import Account
from flask import Flask, request, jsonify
from flask_cors import CORS
import solcx

app = Flask(__name__)
CORS(app)

# Configuration
MINTME_RPC = "https://node.1000x.ch"
MINTME_CHAIN_ID = 24734
EXPLORER_URL = "https://www.mintme.com/explorer"
DEPLOYMENT_COST_MINTME = 10  # Cost in MINTME

# Your private key from environment
MASTER_PRIVATE_KEY = os.environ.get('MASTER_PRIVATE_KEY', '')
if not MASTER_PRIVATE_KEY:
    raise ValueError("MASTER_PRIVATE_KEY not set in environment")

def compile_contract():
    """Compile ERC20 contract"""
    try:
        # ERC20.sol content
        source = """
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract ERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        decimals = 18;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from zero address");
        require(recipient != address(0), "ERC20: transfer to zero address");
        require(_balances[sender] >= amount, "ERC20: insufficient balance");
        _balances[sender] -= amount;
        _balances[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to zero address");
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
"""
        
        try:
            solcx.install_solc('0.8.0')
        except:
            pass
        
        compiled = solcx.compile_source(
            source,
            output_values=['abi', 'bin'],
            solc_version='0.8.0'
        )
        
        for key, data in compiled.items():
            if 'ERC20' in key:
                return {
                    'abi': data['abi'],
                    'bytecode': '0x' + data['bin']
                }
        return None
    except Exception as e:
        print(f"Compilation error: {e}")
        return None

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

@app.route('/api/deploy', methods=['POST'])
def deploy_token():
    """Deploy token endpoint"""
    try:
        data = request.json
        
        # Validate input
        required = ['token_name', 'token_symbol', 'initial_supply', 'owner_address']
        for field in required:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        token_name = data['token_name'].strip()
        token_symbol = data['token_symbol'].strip()
        initial_supply = int(data['initial_supply'])
        owner_address = Web3.to_checksum_address(data['owner_address'].strip())
        
        # Validate supply
        if initial_supply <= 0:
            return jsonify({'success': False, 'error': 'Supply must be greater than 0'}), 400
        
        # Connect to blockchain
        w3 = Web3(Web3.HTTPProvider(MINTME_RPC))
        
        # Add POA middleware
        try:
            from web3.middleware import ExtraDataToPOAMiddleware
            w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except:
            pass
        
        if not w3.is_connected():
            return jsonify({'success': False, 'error': 'Failed to connect to blockchain'}), 500
        
        # Get master account
        master_account = Account.from_key(MASTER_PRIVATE_KEY)
        master_address = master_account.address
        
        # Check master balance
        balance = w3.eth.get_balance(master_address)
        balance_mintme = w3.from_wei(balance, 'ether')
        
        # Check if enough balance
        required_mintme = Web3.to_wei(DEPLOYMENT_COST_MINTME, 'ether')
        if balance < required_mintme:
            return jsonify({
                'success': False, 
                'error': f'Insufficient balance. Need {DEPLOYMENT_COST_MINTME} MINTME. Current: {float(balance_mintme):.2f} MINTME'
            }), 400
        
        # Compile contract
        compiled = compile_contract()
        if not compiled:
            return jsonify({'success': False, 'error': 'Contract compilation failed'}), 500
        
        # Deploy contract
        contract = w3.eth.contract(abi=compiled['abi'], bytecode=compiled['bytecode'])
        nonce = w3.eth.get_transaction_count(master_address)
        gas_price = w3.eth.gas_price
        
        # Build transaction
        tx_data = contract.constructor(token_name, token_symbol).build_transaction({
            'from': master_address,
            'nonce': nonce,
            'gas': 2000000,
            'gasPrice': gas_price,
            'chainId': MINTME_CHAIN_ID,
        })
        
        # Sign and send
        signed_tx = master_account.sign_transaction(tx_data)
        raw_tx = signed_tx.raw_transaction if hasattr(signed_tx, 'raw_transaction') else signed_tx.rawTransaction
        
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        tx_hash_hex = tx_hash.hex()
        
        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        
        if receipt.status != 1:
            return jsonify({'success': False, 'error': 'Deployment failed'}), 500
        
        contract_address = receipt.contractAddress
        
        # Mint tokens to owner
        mint_tx = contract.functions.mint(owner_address, initial_supply).build_transaction({
            'from': master_address,
            'nonce': nonce + 1,
            'gas': 200000,
            'gasPrice': gas_price,
            'chainId': MINTME_CHAIN_ID,
        })
        
        signed_mint = master_account.sign_transaction(mint_tx)
        raw_mint = signed_mint.raw_transaction if hasattr(signed_mint, 'raw_transaction') else signed_mint.rawTransaction
        
        mint_hash = w3.eth.send_raw_transaction(raw_mint)
        mint_hash_hex = mint_hash.hex()
        
        mint_receipt = w3.eth.wait_for_transaction_receipt(mint_hash, timeout=180)
        
        if mint_receipt.status != 1:
            return jsonify({'success': False, 'error': 'Minting failed'}), 500
        
        # Return success
        return jsonify({
            'success': True,
            'contract_address': contract_address,
            'explorer_url': f"{EXPLORER_URL}/address/{contract_address}",
            'tx_hash': tx_hash_hex,
            'mint_tx_hash': mint_hash_hex,
            'owner': owner_address,
            'token_name': token_name,
            'token_symbol': token_symbol,
            'total_supply': initial_supply,
            'deployment_cost': DEPLOYMENT_COST_MINTME
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/estimate', methods=['POST'])
def estimate_cost():
    """Estimate deployment cost"""
    return jsonify({
        'cost_mintme': DEPLOYMENT_COST_MINTME,
        'cost_usd': '~$2.1',
        'chain': 'MintMe',
        'chain_id': MINTME_CHAIN_ID
    })

# Vercel serverless handler
def handler(request, context):
    return app(request, context)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
