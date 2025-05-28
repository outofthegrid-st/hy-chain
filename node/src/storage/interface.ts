import HyChainFormat from "../format";


export interface IStorage {
  putBlock(b: HyChainFormat.IBlock): Promise<boolean>;
}


export abstract class AbstractStorageObject implements IStorage {
  public abstract putBlock(b: HyChainFormat.IBlock): Promise<boolean>;
}
