import {
  BeforeInsert,
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  JoinColumn,
  JoinTable,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { Role } from '../rbac/entities/role.entity';
import { Company } from '../companies/company.entity';
import * as bcrypt from 'bcrypt';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'text', nullable: true })
  refreshTokenHash: string | null;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company> | null;

  @ManyToMany(() => Role, { cascade: ['insert'] })
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
    },
  })
  roles?: Relation<Role>[];

  @BeforeInsert()
  normalizeEmail() {
    this.email = this.email.toLowerCase();
  }

  async setPassword(plain: string) {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(plain, salt);
  }

  async comparePassword(plain: string) {
    return bcrypt.compare(plain, this.passwordHash);
  }
}
