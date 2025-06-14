use std::fmt;
use base64::engine::{general_purpose, Engine as _};


#[derive(Clone)]
pub struct IHashEntity {
  pub byte_length: u64,
  data: Vec<u8>,
}


impl IHashEntity {
  pub fn new(data: Vec<u8>) -> Self {
    let byte_length = data.len() as u64;
    IHashEntity { byte_length, data }
  }

  pub fn digest(&self, encoding: Option<&str>) -> String {
    match encoding {
      Some("hex") | None => self
        .data
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>(),
        
      Some("base64") => general_purpose::STANDARD.encode(&self.data),
      Some(enc) => panic!("Unsupported encoding '{}'", enc),
    }
  }

  pub fn bytes(&self) -> Vec<usize> {
    self.data.iter().map(|&b| b as usize).collect()
  }

  pub fn buffer(&self) -> Vec<u8> {
    self.data.clone()
  }
}

impl fmt::Debug for IHashEntity {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result  {
    f.debug_struct("IHashEntity")
      .field("byte_length", &self.byte_length)
      .field("digest", &self.digest(Some("hex")))
      .finish()
  }
}
