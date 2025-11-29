use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use rand::Rng;

const NONCE_SIZE: usize = 12;

pub fn hash_password(password: &str) -> Result<String, Box<dyn std::error::Error>> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();
    Ok(password_hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, Box<dyn std::error::Error>> {
    let parsed_hash = PasswordHash::new(hash)?;
    let argon2 = Argon2::default();
    Ok(argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

pub fn derive_key(password: &str) -> Vec<u8> {
    use argon2::Argon2;
    let mut key = [0u8; 32];
    let salt = b"PassKeeperSalt01"; // Fixed salt for key derivation
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .expect("Failed to derive key");
    key.to_vec()
}

pub fn encrypt(data: &str, key: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)?;
    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; NONCE_SIZE] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(base64::encode(&result))
}

pub fn decrypt(encrypted_data: &str, key: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
    let decoded = base64::decode(encrypted_data)?;

    if decoded.len() < NONCE_SIZE {
        return Err("Invalid encrypted data".into());
    }

    let (nonce_bytes, ciphertext) = decoded.split_at(NONCE_SIZE);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = ChaCha20Poly1305::new_from_slice(key)?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption error: {}", e))?;

    Ok(String::from_utf8(plaintext)?)
}

pub fn generate_password(
    length: usize,
    use_uppercase: bool,
    use_lowercase: bool,
    use_numbers: bool,
    use_symbols: bool,
) -> Result<String, Box<dyn std::error::Error>> {
    let mut charset = String::new();

    if use_uppercase {
        charset.push_str("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if use_lowercase {
        charset.push_str("abcdefghijklmnopqrstuvwxyz");
    }
    if use_numbers {
        charset.push_str("0123456789");
    }
    if use_symbols {
        charset.push_str("!@#$%^&*()_+-=[]{}|;:,.<>?");
    }

    if charset.is_empty() {
        return Err("At least one character type must be selected".into());
    }

    let mut rng = rand::thread_rng();
    let password: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            charset.chars().nth(idx).unwrap()
        })
        .collect();

    Ok(password)
}
