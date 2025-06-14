use crate::types::hash::IHashEntity;

mod types;


fn main() {
  let bytes: [u8; 5] = [0x48, 0x59, 0x20, 0x43, 0x48];
  let hash: IHashEntity = IHashEntity::new(bytes.to_vec());

  println!("Hash Entity: {:?}", hash);
}
