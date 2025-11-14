import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('ppp_users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({
        unique:true
    })
    email: string;

    @Column({select:false})
    password: string;

    @Column()
    fullName: string;

    @Column('boolean',{
        default:false
    })
    isActive: boolean;

    @Column()
    phone:string
  
    @Column('simple-json', { nullable: true })
    roles: string[];

}