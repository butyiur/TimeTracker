using System.Net;
using System.Net.Mail;
using System.Text;

namespace TimeTracker.Api.Services;

public sealed class EmailOptions
{
    public string From { get; set; } = "no-reply@timetracker.local";
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? UserName { get; set; }
    public string? Password { get; set; }
    public string PasswordResetSpaBaseUrl { get; set; } = "http://localhost:4200";
    public string EmailConfirmationSpaBaseUrl { get; set; } = "http://localhost:4200";
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly EmailOptions _options;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(Microsoft.Extensions.Options.IOptions<EmailOptions> options, IWebHostEnvironment environment, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _environment = environment;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to))
            return;

        if (string.IsNullOrWhiteSpace(_options.SmtpHost))
        {
            await WriteMailboxFallbackAsync(to, subject, htmlBody, ct);
            return;
        }

        using var message = new MailMessage(_options.From, to, subject, htmlBody)
        {
            IsBodyHtml = true,
            BodyEncoding = Encoding.UTF8,
            SubjectEncoding = Encoding.UTF8,
        };

        using var client = new SmtpClient(_options.SmtpHost, _options.SmtpPort)
        {
            EnableSsl = _options.UseSsl,
        };

        if (!string.IsNullOrWhiteSpace(_options.UserName))
        {
            client.Credentials = new NetworkCredential(_options.UserName, _options.Password ?? string.Empty);
        }

        ct.ThrowIfCancellationRequested();
        await client.SendMailAsync(message);
    }

    private async Task WriteMailboxFallbackAsync(string to, string subject, string htmlBody, CancellationToken ct)
    {
        var basePath = string.IsNullOrWhiteSpace(_environment.ContentRootPath)
            ? AppContext.BaseDirectory
            : _environment.ContentRootPath;

        var folder = Path.Combine(basePath, "App_Data");
        Directory.CreateDirectory(folder);

        var filePath = Path.Combine(folder, "dev-mailbox.log");
        var entry = $"[{DateTimeOffset.UtcNow:O}] TO={to} SUBJECT={subject}{Environment.NewLine}{htmlBody}{Environment.NewLine}---{Environment.NewLine}";

        await File.AppendAllTextAsync(filePath, entry, Encoding.UTF8, ct);
        _logger.LogInformation("SMTP is not configured. Reset email written to {FilePath}", filePath);
    }
}
