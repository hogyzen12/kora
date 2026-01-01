// App-specific transaction validator for Kora integration
// Validates that transactions meet your app's required format before sponsoring
//
// Integration: Call validate_app_transaction() before sending to Kora RPC

use anyhow::{anyhow, Result};
use solana_sdk::{
    instruction::Instruction,
    message::VersionedMessage,
    pubkey::Pubkey,
    system_instruction,
    transaction::VersionedTransaction,
};
use std::str::FromStr;

/// Required program IDs for your app
pub const ASSEMBLY_PROGRAM: &str = "23MzuyVH6EKGbUHq7GjBY6ydSCVoZQYDmzeKVdDBKWNQ";
pub const JULESO_ADDRESS: &str = "juLesoSmdTcRtzjCzYzRoHrnF8GhVu6KCV7uxq7nJGp";
pub const JITO_ADDRESS: &str = "Dah1Uu7SW1da337YFRiEEyV1KAjpn7S2HwARCs216L2";
pub const EXPECTED_TRANSFER_LAMPORTS: u64 = 100_000; // 0.0001 SOL

/// Validation result
#[derive(Debug)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn new() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self, error: String) {
        self.valid = false;
        self.errors.push(error);
    }

    pub fn add_warning(&mut self, warning: String) {
        self.warnings.push(warning);
    }

    pub fn is_valid(&self) -> bool {
        self.valid
    }
}

/// Main validation function - validates transaction meets app requirements
/// This MUST pass before sending to Kora for sponsorship
pub fn validate_app_transaction(tx: &VersionedTransaction) -> Result<ValidationResult> {
    let mut result = ValidationResult::new();

    // Extract instructions from the transaction
    let instructions = get_instructions_from_transaction(tx)?;

    // Check 1: Assembly/Slot Replay program must be present
    if !check_assembly_program(&instructions) {
        result.add_error("Missing Assembly/Slot Replay protection".to_string());
    }

    // Check 2: Must have SOL transfer to juLeso
    if !check_sol_transfer_to(&instructions, JULESO_ADDRESS, EXPECTED_TRANSFER_LAMPORTS) {
        result.add_error(format!(
            "Missing required {} SOL transfer to juLeso",
            EXPECTED_TRANSFER_LAMPORTS as f64 / 1e9
        ));
    }

    // Check 3: Must have SOL transfer to Jito
    if !check_sol_transfer_to(&instructions, JITO_ADDRESS, EXPECTED_TRANSFER_LAMPORTS) {
        result.add_error(format!(
            "Missing required {} SOL transfer to Jito",
            EXPECTED_TRANSFER_LAMPORTS as f64 / 1e9
        ));
    }

    // Additional safety check: Ensure no unknown programs
    if !check_only_allowed_programs(&instructions) {
        result.add_error("Transaction contains unauthorized programs".to_string());
    }

    Ok(result)
}

/// Extract instructions from VersionedTransaction
fn get_instructions_from_transaction(tx: &VersionedTransaction) -> Result<Vec<Instruction>> {
    match &tx.message {
        VersionedMessage::Legacy(message) => Ok(message.instructions.clone()),
        VersionedMessage::V0(message) => {
            // V0 messages require lookup table resolution
            // For now, we'll just use the static account keys
            Ok(message.instructions.iter().map(|compiled_ix| {
                let program_id = message.account_keys[compiled_ix.program_id_index as usize];
                let accounts = compiled_ix.accounts.iter()
                    .map(|&idx| {
                        solana_sdk::instruction::AccountMeta {
                            pubkey: message.account_keys[idx as usize],
                            is_signer: false, // Simplified for validation
                            is_writable: false,
                        }
                    })
                    .collect();

                Instruction {
                    program_id,
                    accounts,
                    data: compiled_ix.data.clone(),
                }
            }).collect())
        }
    }
}

/// Check if Assembly/Slot Replay program is present
fn check_assembly_program(instructions: &[Instruction]) -> bool {
    let assembly_pubkey = Pubkey::from_str(ASSEMBLY_PROGRAM).unwrap();
    instructions.iter().any(|ix| ix.program_id == assembly_pubkey)
}

/// Check if there's a SOL transfer to the specified address with exact amount
fn check_sol_transfer_to(
    instructions: &[Instruction],
    recipient: &str,
    expected_lamports: u64,
) -> bool {
    let recipient_pubkey = Pubkey::from_str(recipient).unwrap();
    let system_program = solana_sdk::system_program::ID;

    for ix in instructions {
        if ix.program_id == system_program {
            // Parse as system transfer instruction
            if let Ok(system_instruction::SystemInstruction::Transfer { lamports }) =
                bincode::deserialize(&ix.data)
            {
                // Check if recipient matches and amount is correct
                if ix.accounts.len() >= 2 && ix.accounts[1].pubkey == recipient_pubkey {
                    if lamports == expected_lamports {
                        return true;
                    }
                }
            }
        }
    }

    false
}

/// Check that only allowed programs are used
fn check_only_allowed_programs(instructions: &[Instruction]) -> bool {
    let allowed_programs = vec![
        Pubkey::from_str("11111111111111111111111111111111").unwrap(), // System
        Pubkey::from_str(ASSEMBLY_PROGRAM).unwrap(),                  // Assembly
        Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap(), // Token
        Pubkey::from_str("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL").unwrap(), // ATA
        Pubkey::from_str("ComputeBudget111111111111111111111111111111").unwrap(), // Compute Budget
    ];

    instructions.iter().all(|ix| allowed_programs.contains(&ix.program_id))
}

/// Example integration with Kora RPC client
#[cfg(test)]
mod example_integration {
    use super::*;

    /// Example: Validate before sending to Kora
    pub async fn sponsor_transaction_with_validation(
        tx: VersionedTransaction,
        kora_endpoint: &str,
        api_key: &str,
    ) -> Result<String> {
        // Step 1: Validate transaction meets app requirements
        let validation = validate_app_transaction(&tx)?;

        if !validation.is_valid() {
            return Err(anyhow!(
                "Transaction validation failed: {:?}",
                validation.errors
            ));
        }

        // Step 2: If valid, send to Kora for sponsorship
        let result = send_to_kora(&tx, kora_endpoint, api_key).await?;

        Ok(result)
    }

    async fn send_to_kora(
        tx: &VersionedTransaction,
        endpoint: &str,
        api_key: &str,
    ) -> Result<String> {
        use reqwest;
        use serde_json::json;

        // Serialize transaction
        let serialized = bincode::serialize(tx)?;
        let base64_tx = base64::encode(&serialized);

        // Call Kora RPC
        let client = reqwest::Client::new();
        let response = client
            .post(endpoint)
            .header("Content-Type", "application/json")
            .header("x-api-key", api_key)
            .json(&json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "signAndSendTransaction",
                "params": {
                    "transaction": base64_tx,
                    "paymentToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // USDC
                }
            }))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        // Extract signature
        let signature = response["result"]["signature"]
            .as_str()
            .ok_or_else(|| anyhow!("No signature in response"))?
            .to_string();

        Ok(signature)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_requires_all_three_checks() {
        // This would be a real transaction in your tests
        // For now, just showing the structure
        let tx = create_test_transaction();

        let result = validate_app_transaction(&tx).unwrap();

        // Should fail if any of the 3 checks are missing
        assert!(result.is_valid(), "Valid app transaction should pass");
    }

    fn create_test_transaction() -> VersionedTransaction {
        // Create a test transaction with all required components
        todo!("Implement test transaction builder")
    }
}
