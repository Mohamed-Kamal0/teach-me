using System.Text;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using TeachMe.Api.Common;
using Xunit;

namespace TeachMe.Api.Tests;

/// <summary>
/// Pure unit tests for the image pipeline — no WebApplicationFactory. Every stored byte is
/// produced by our encoder, and the header-only guards fire before a full decode.
/// </summary>
public class AvatarImageProcessorTests
{
    private readonly AvatarImageProcessor _processor = new();

    [Fact]
    public void Wide_png_becomes_a_256_square_webp()
    {
        using var source = new Image<Rgba32>(4000, 1000, new Rgba32(30, 144, 255));
        using var upload = new MemoryStream();
        source.SaveAsPng(upload);
        upload.Position = 0;

        var result = _processor.Process(upload);

        Assert.Equal(256, result.Width);
        Assert.Equal(256, result.Height);

        using var decoded = Image.Load(result.Webp);
        Assert.Equal(256, decoded.Width);
        Assert.Equal(256, decoded.Height);
        Assert.Equal("Webp", Image.DetectFormat(result.Webp).Name);
    }

    [Fact]
    public void A_text_file_is_rejected_with_a_validation_error()
    {
        using var upload = new MemoryStream(Encoding.UTF8.GetBytes("this is not an image, it is prose"));

        Assert.Throws<ValidationApiException>(() => _processor.Process(upload));
    }

    [Fact]
    public void An_oversized_header_is_rejected_without_a_full_decode()
    {
        // A hand-built PNG whose IHDR claims 12000x12000 but which carries no pixel data at all.
        // If the guard decoded the image it would fail differently (or OOM); a ValidationApiException
        // is proof the dimension ceiling tripped on the header alone.
        using var upload = new MemoryStream(PngHeaderClaiming(12000, 12000));

        var ex = Assert.Throws<ValidationApiException>(() => _processor.Process(upload));
        Assert.Contains("8000", string.Join(" ", ex.Errors.SelectMany(e => e.Value)));
    }

    [Fact]
    public void Centre_crop_keeps_the_middle_of_a_wide_image()
    {
        // Left third red, middle third green, right third blue. After a centre crop the sampled
        // middle pixel must still be green.
        var red = new Rgba32(220, 20, 20);
        var green = new Rgba32(20, 220, 20);
        var blue = new Rgba32(20, 20, 220);
        using var source = new Image<Rgba32>(900, 300);
        source.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < accessor.Height; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (var x = 0; x < row.Length; x++)
                {
                    row[x] = x < 300 ? red : x < 600 ? green : blue;
                }
            }
        });
        using var upload = new MemoryStream();
        source.SaveAsPng(upload);
        upload.Position = 0;

        var result = _processor.Process(upload);

        using var decoded = Image.Load<Rgba32>(result.Webp);
        var centre = decoded[128, 128];
        Assert.True(centre.G > 150, $"expected a green centre pixel, got {centre}");
        Assert.True(centre.R < 100 && centre.B < 100, $"expected a green centre pixel, got {centre}");
    }

    private static byte[] PngHeaderClaiming(int width, int height)
    {
        var png = new List<byte> { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

        var ihdr = new byte[13];
        BitConverterBigEndian(width).CopyTo(ihdr, 0);
        BitConverterBigEndian(height).CopyTo(ihdr, 4);
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 2;  // colour type: truecolour
        ihdr[10] = 0; // compression
        ihdr[11] = 0; // filter
        ihdr[12] = 0; // interlace

        AppendChunk(png, "IHDR", ihdr);
        AppendChunk(png, "IEND", []);
        return png.ToArray();
    }

    private static void AppendChunk(List<byte> target, string type, byte[] data)
    {
        target.AddRange(BitConverterBigEndian(data.Length));
        var typeBytes = Encoding.ASCII.GetBytes(type);
        target.AddRange(typeBytes);
        target.AddRange(data);
        var crc = Crc32(typeBytes.Concat(data).ToArray());
        target.AddRange(BitConverterBigEndian((int)crc));
    }

    private static byte[] BitConverterBigEndian(int value)
    {
        var bytes = BitConverter.GetBytes(value);
        if (BitConverter.IsLittleEndian)
        {
            Array.Reverse(bytes);
        }
        return bytes;
    }

    private static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (var b in data)
        {
            crc ^= b;
            for (var i = 0; i < 8; i++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
            }
        }
        return crc ^ 0xFFFFFFFF;
    }
}
