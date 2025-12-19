import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Error hashing password: ' + error.message);
  }
}

export async function comparePassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Error comparing password: ' + error.message);
  }
}
