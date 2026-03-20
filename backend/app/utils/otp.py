import secrets


def generate_otp(length: int = 6) -> str:
    max_value = 10**length
    return f"{secrets.randbelow(max_value):0{length}d}"
