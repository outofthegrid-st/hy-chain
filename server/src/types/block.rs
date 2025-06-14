use std::collections::HashMap;

use crate::types::hash::IHashEntity;


// Add Serialize/Deserialize from JSON
#[derive(Debug, Clone)]
pub enum JsonValue {
  String(String),
  Number(f64),
  Bool(bool),
  Null,
}


// Add Serialize/Deserialize from JSON
#[derive(Debug, Clone)]
pub struct BlockHeaders {
  pub ts:u64,
  pub timestamp: String,
  pub content_length: usize,
  pub merkle_root: String,
  pub version: u32,
  pub nonce: u64,
}


// Add Serialize/Deserialize from JSON
#[derive(Debug, Clone)]
pub struct Transaction<T> {
  pub payload: T,
  pub sequence: u64,
}


// Add Serialize/Deserialize from JSON
#[derive(Debug, Clone)]
pub struct Block<T> {
  pub _id: String,
  pub public_block_id: String,
  pub previous_hash: IHashEntity,
  pub sequence: u64,
  pub transactions: Vec<Transaction<T>>,
  pub headers: BlockHeaders,
  pub metadata: HashMap<String, JsonValue>,
  pub content_signature: IHashEntity,
  pub block_signature: IHashEntity,
}