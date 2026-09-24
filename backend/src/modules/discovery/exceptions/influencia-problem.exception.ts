import { HttpException } from '@nestjs/common';

export type InfluenciaProblemBody = {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
};

export class InfluenciaProblemException extends HttpException {
  constructor(status: number, detail: string) {
    const body: InfluenciaProblemBody = {
      type: 'about:blank',
      title: 'Error de influencia',
      status,
      detail,
    };
    super(body, status);
  }
}
