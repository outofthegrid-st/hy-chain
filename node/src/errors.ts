import { devNull } from "./@internals/util";
import { jsonSafeStringify } from "./@internals/safe-json";


enum ERROR_CODE {
  UNKNOWN_ERROR = 1087,
  ERR_INVALID_CHUNK = 1083,
  ERR_RESOURCE_DISPOSED = 1043,
  ERR_END_OF_STREAM = 10392,
  ERR_UNSUPPORTED_OPERATION = 1079,
  ERR_NOT_IMPLEMENTED = 1078,
  ERR_INVALID_ARGUMENT = 1081,
  ERR_TOKEN_CANCELLED = 1053,
}


export class HyChainException extends Error {
  public override readonly name: string;
  public readonly code: number;

  public constructor(
    message: string,
    code: keyof typeof ERROR_CODE | number = "UNKNOWN_ERROR",
    public readonly context?: unknown // eslint-disable-line comma-dangle
  ) {
    super(message);

    this.name = "HyChainException";
    
    this.code = -Math.abs(typeof code === "number" ?
      code : 
      ERROR_CODE[code] ?? ERROR_CODE.UNKNOWN_ERROR);
  }

  public getCode(): string {
    return ERROR_CODE[-this.code].toUpperCase();
  }
}

export class HyChainNotImplementedException extends HyChainException {
  public override readonly name: string;

  public constructor(source: string, _paramsCollector?: readonly unknown[]) {
    super(`The resource \`${source.trim()}\` is not implemented yet`, "ERR_NOT_IMPLEMENTED");
    
    _paramsCollector = null!;
    devNull(_paramsCollector);

    this.name = "HyChainNotImplementedException";
  }
}


export function stringifyErrorStackt(context?: unknown): string {
  if(!context)
    return "[no stack trace information]";

  if(typeof context !== "object")
    return ("" + String(context)) || "[no stack trace information]";

  if("stackTrace" in context) {
    const obj = (context as { stackTrace: { value?: string } });

    if(typeof obj.stackTrace.toString === "function")
      return obj.stackTrace.toString() || "[no stack trace information]";

    return obj.stackTrace.value || "[no stack trace information]";
  }

  return (context as { stack?: string }).stack || "[no stack trace information]";
}

export function stringifyError(err: unknown, description?: string): string {
  const stack = stringifyErrorStackt(err)
    .trim()
    .replace(/^at/, "");

  if(err instanceof HyChainException) {
    let context: any = err.context ? jsonSafeStringify(err.context, null, 2) : null;

    if(context?.isRight()) {
      context = context.value;
    }

    return `${err.getCode()} (${err.code}): ${err.message}\n\t${description ? ("" + description + "\n\t") : ""}with @context${context ?? "[NULL]"}\n\tat ${stack}`;
  }

  if(err instanceof Error)
    return `${err.message}\n\t${description ? ("" + description + "\n\t") : ""}at ${stack}`;

  return (
    ("" + String(err)) ||
    "[missing error information]"
  );
}
