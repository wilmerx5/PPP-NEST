import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserAddressesService } from './user-addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Auth } from './decorators/auth.decorator';
import { User } from './entities/user.entity';
import { Request } from 'express';
import { transformDatesToBogota } from '../common/utils/date.util';

@ApiTags('User Addresses')
@Controller('auth/addresses')
@Auth()
@ApiBearerAuth()
export class UserAddressesController {
  constructor(private readonly addressesService: UserAddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva dirección para el usuario autenticado' })
  @ApiResponse({ status: 201, description: 'Dirección creada exitosamente' })
  async create(@Req() req: Request, @Body() createAddressDto: CreateAddressDto) {
    const user = req.user as User;
    const address = await this.addressesService.create(user.id, createAddressDto);
    return transformDatesToBogota(address, ['createdAt', 'updatedAt']);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las direcciones del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de direcciones' })
  async findAll(@Req() req: Request) {
    const user = req.user as User;
    const addresses = await this.addressesService.findAll(user.id);
    return addresses.map(addr => transformDatesToBogota(addr, ['createdAt', 'updatedAt']));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una dirección específica por ID' })
  @ApiResponse({ status: 200, description: 'Dirección encontrada' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  async findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    const address = await this.addressesService.findOne(user.id, id);
    return transformDatesToBogota(address, ['createdAt', 'updatedAt']);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una dirección' })
  @ApiResponse({ status: 200, description: 'Dirección actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    const user = req.user as User;
    const address = await this.addressesService.update(user.id, id, updateAddressDto);
    return transformDatesToBogota(address, ['createdAt', 'updatedAt']);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una dirección' })
  @ApiResponse({ status: 200, description: 'Dirección eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Dirección no encontrada' })
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.addressesService.remove(user.id, id);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Establecer una dirección como predeterminada' })
  @ApiResponse({ status: 200, description: 'Dirección establecida como predeterminada' })
  async setDefault(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    const address = await this.addressesService.setDefault(user.id, id);
    return transformDatesToBogota(address, ['createdAt', 'updatedAt']);
  }
}
