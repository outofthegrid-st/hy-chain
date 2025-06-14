/* eslint-disable @typescript-eslint/no-namespace, no-inner-declarations */


namespace fmt {
  export interface IBinary {
    $binary(): Buffer;
    $bytes(): Uint8Array;
  }
}

export default fmt;
