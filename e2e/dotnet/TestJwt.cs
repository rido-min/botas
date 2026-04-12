using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

namespace Botas.E2ETests;

/// <summary>
/// Generates test JWT tokens signed with a deterministic in-memory key.
/// Used by EchoBotFactory to override the bot's JWT validation parameters
/// and by tests to create Bearer tokens for requests.
/// </summary>
public static class TestJwt
{
    public const string Issuer = "test-issuer";
    public const string Audience = "test-client-id";

    public static readonly SymmetricSecurityKey SigningKey =
        new(Encoding.UTF8.GetBytes("e2e-test-signing-key-must-be-32chars!"));

    public static string Generate(DateTime? expires = null)
    {
        JwtSecurityTokenHandler handler = new();
        SecurityToken token = handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Issuer,
            Audience = Audience,
            SigningCredentials = new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256),
            Expires = expires ?? DateTime.UtcNow.AddHours(1),
        });
        return handler.WriteToken(token);
    }
}
