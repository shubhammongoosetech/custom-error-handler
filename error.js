export class HttpException extends Error {
  statusCode: number;
  code: string;

  constructor({
    statusCode,
    code,
    message,
  }: {
    statusCode: number,
    code: string,
    message: string,
  }) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 400, code, message });
  }
}

export class UnauthorizedException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 401, code, message });
  }
}

export class ForbiddenException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 403, code, message });
  }
}

export class NotFoundException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 404, code, message });
  }
}

export class ConflictException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 409, code, message });
  }
}

export class UnprocessableEntityException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 422, code, message });
  }
}

export class InternalServerErrorException extends HttpException {
  constructor({ code, message }: { code: string, message: string }) {
    super({ statusCode: 500, code, message });
  }
}
