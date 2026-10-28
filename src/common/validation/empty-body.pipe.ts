import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

@Injectable()
export class EmptyBodyPipe implements PipeTransform {
  transform(value: unknown) {
    if (value === undefined || (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) return;
    throw new BadRequestException('This action does not accept body fields');
  }
}
