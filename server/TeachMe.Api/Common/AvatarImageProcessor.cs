using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace TeachMe.Api.Common;

public interface IAvatarImageProcessor
{
    /// <summary>
    /// Re-encodes an uploaded image to a 256x256 WebP. The returned bytes are always produced by
    /// our encoder — the caller's bytes never leave the request. Throws
    /// <see cref="ValidationApiException"/> when the upload isn't a raster image, is implausibly
    /// large, or cannot be squeezed under the output size cap.
    /// </summary>
    AvatarImage Process(Stream upload);
}

public readonly record struct AvatarImage(byte[] Webp, int Width, int Height);

public class AvatarImageProcessor : IAvatarImageProcessor
{
    private const int OutputSize = 256;
    private const int DimensionCeiling = 8000;
    private const int OutputByteCap = 200_000;

    public AvatarImage Process(Stream upload)
    {
        // 1. Header only — reject anything that isn't a raster image, or whose declared
        //    dimensions are implausible, before committing to a full decode (bomb guard).
        upload.Position = 0;
        ImageInfo info;
        try
        {
            info = Image.Identify(upload);
        }
        catch (ImageFormatException)
        {
            throw new ValidationApiException("file", "That file isn't an image we can use. Upload a JPEG, PNG or WebP.");
        }

        if (info.Width > DimensionCeiling || info.Height > DimensionCeiling)
        {
            throw new ValidationApiException("file", "That image is too large. Use one no bigger than 8000 pixels on a side.");
        }

        upload.Position = 0;

        using var image = Image.Load(upload);

        image.Mutate(ctx =>
        {
            ctx.AutoOrient();
            ctx.Resize(new ResizeOptions
            {
                Size = new Size(OutputSize, OutputSize),
                Mode = ResizeMode.Crop,
                Position = AnchorPositionMode.Center,
                Sampler = KnownResamplers.Lanczos3
            });
        });

        var bytes = Encode(image, quality: 80);
        if (bytes.Length > OutputByteCap)
        {
            bytes = Encode(image, quality: 60);
        }

        if (bytes.Length > OutputByteCap)
        {
            throw new ValidationApiException("file", "We couldn't make that image small enough. Try a simpler photo.");
        }

        return new AvatarImage(bytes, image.Width, image.Height);
    }

    private static byte[] Encode(Image image, int quality)
    {
        using var output = new MemoryStream();
        image.Save(output, new WebpEncoder { Quality = quality, FileFormat = WebpFileFormatType.Lossy });
        return output.ToArray();
    }
}
