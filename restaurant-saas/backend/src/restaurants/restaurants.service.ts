import { Injectable } from '@nestjs/common';

@Injectable()
export class RestaurantsService {
  findAll() {
    return [];
  }

  findOne(id: string) {
    return { id };
  }

  create(data: any) {
    return data;
  }

  update(id: string, data: any) {
    return { id, ...data };
  }

  remove(id: string) {
    return { id };
  }
}
