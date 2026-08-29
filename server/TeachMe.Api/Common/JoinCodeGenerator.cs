using System.Security.Cryptography;

namespace TeachMe.Api.Common;

public static class JoinCodeGenerator
{
    // Crockford base32 alphabet — excludes I, L, O, U to avoid ambiguity with 1, 1, 0, and profanity.
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    public static string Generate()
    {
        Span<char> chars = stackalloc char[8];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }
        return new string(chars);
    }

    /// Uppercases and normalises a hand-copied code: O→0, I/L→1.
    public static string Normalize(string input)
    {
        var upper = input.Trim().ToUpperInvariant();
        var chars = new char[upper.Length];
        for (var i = 0; i < upper.Length; i++)
        {
            chars[i] = upper[i] switch
            {
                'O' => '0',
                'I' or 'L' => '1',
                _ => upper[i]
            };
        }
        return new string(chars);
    }

    public static bool IsWellFormed(string code) =>
        code.Length == 8 && code.All(c => Alphabet.Contains(c));
}
