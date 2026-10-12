import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantsController {
  @Get()
  @ApiOperation({ summary: 'List all restaurants' })
  findAll() {
    return { data: [] };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant by id' })
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  @ApiOperation({ summary: 'Create restaurant' })
  create(@Body() body: any) {
    return { message: 'Created', data: body };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update restaurant' })
  update(@Param('id') id: string, @Body() body: any) {
    return { id, data: body };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete restaurant' })
  remove(@Param('id') id: string) {
    return { message: 'Deleted', id };
  }
}
