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
import { UserPhonesService } from './user-phones.service';
import { CreatePhoneDto } from './dto/create-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { Auth } from './decorators/auth.decorator';
import { User } from './entities/user.entity';
import { Request } from 'express';

@ApiTags('User Phones')
@Controller('auth/phones')
@Auth()
@ApiBearerAuth()
export class UserPhonesController {
  constructor(private readonly phonesService: UserPhonesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo teléfono para el usuario autenticado' })
  @ApiResponse({ status: 201, description: 'Teléfono creado exitosamente' })
  create(@Req() req: Request, @Body() createPhoneDto: CreatePhoneDto) {
    const user = req.user as User;
    return this.phonesService.create(user.id, createPhoneDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los teléfonos del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de teléfonos' })
  findAll(@Req() req: Request) {
    const user = req.user as User;
    return this.phonesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un teléfono específico por ID' })
  @ApiResponse({ status: 200, description: 'Teléfono encontrado' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.phonesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un teléfono' })
  @ApiResponse({ status: 200, description: 'Teléfono actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePhoneDto: UpdatePhoneDto,
  ) {
    const user = req.user as User;
    return this.phonesService.update(user.id, id, updatePhoneDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un teléfono' })
  @ApiResponse({ status: 200, description: 'Teléfono eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Teléfono no encontrado' })
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.phonesService.remove(user.id, id);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Establecer un teléfono como predeterminado' })
  @ApiResponse({ status: 200, description: 'Teléfono establecido como predeterminado' })
  setDefault(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const user = req.user as User;
    return this.phonesService.setDefault(user.id, id);
  }
}
