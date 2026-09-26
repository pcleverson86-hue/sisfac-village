(function Md5Main(ns)
{

    function repeatElem(e, t)
    {
        var r = [];
        for (var i = 0; i < t; i++)
            r = r.concat(e);
        return r;
    }
    var S = repeatElem([7, 12, 17, 22], 4);
    S = S.concat(repeatElem([5, 9, 14, 20], 4));
    S = S.concat(repeatElem([4, 11, 16, 23], 4));
    S = S.concat(repeatElem([6, 10, 15, 21], 4));

    var K = [
              0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
              0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
              0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
              0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
              0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
              0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
              0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
              0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
              0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
              0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
              0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
              0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
              0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
              0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
              0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
              0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
        ];

    var A0 = 0x67452301;
    var B0 = 0xefcdab89;
    var C0 = 0x98badcfe;
    var D0 = 0x10325476;

    function RotateLeft(i, s)
    {
        return ((i << s) | (i >>> (32 - s)));
    }
    function UnsignedSum(x, y)
    {
        return (x + y) & 0xFFFFFFFF;
    }
    function toHexString(v)
    {
        var s = "";
        for (var i = 0; i < 4; i++)
            s += ((v >>> ((i * 8) + 4)) & 0x0f).toString(16) + ((v >>> (i * 8)) & 0x0f).toString(16);
        return s;
    }
    function dataPrepare(inData)
    {
        var d = inData;
        var l = d.length;
        var res = [];
        d += ns.StringFromCharCode(0x80);
        while (d.length % 4) d += ns.StringFromCharCode(0x0);
        for (var i = 0; i < d.length; i += 4)
            res.push((d.charCodeAt(i)) | (d.charCodeAt(i + 1) << 8) | (d.charCodeAt(i + 2) << 16) | (d.charCodeAt(i + 3) << 24));
        while (res.length % 16 !== 14) res.push(0x0);
        res.push(l << 3);
        res.push(l >>> 29);
        return res;
    }

    ns.md5 = function md5(data)
    {
        var words = dataPrepare(data);
        var A = A0;
        var B = B0;
        var C = C0;
        var D = D0;
        for (var i = 0; i < words.length; i += 16)
        {
            var a = A;
            var b = B;
            var c = C;
            var d = D;
            var block = words.slice(i, i + 16);
            for (var j = 0; j < 64; j++)
            {
                var f = 0;
                var g = 0;
                switch (Math.floor(j / 16))
                {
                    case 0:
                        f = (b & c) | ((~b) & d);
                        g = j;
                        break;
                    case 1:
                        f = (d & b) | ((~d) & c);
                        g = (5 * j) + 1;
                        break;
                    case 2:
                        f = b ^ c ^ d;
                        g = (3 * j) + 5;
                        break;
                    case 3:
                        f = c ^ (b | (~d));
                        g = 7 * j;
                        break;
                    default:
                }
                g -= 16 * Math.floor(g / 16);
                f = UnsignedSum(UnsignedSum(f, a), UnsignedSum(K[j], block[g]));
                a = d;
                d = c;
                c = b;
                b = UnsignedSum(b, RotateLeft(f, S[j]));
            }
            A = UnsignedSum(A, a);
            B = UnsignedSum(B, b);
            C = UnsignedSum(C, c);
            D = UnsignedSum(D, d);

        }
        var digest = toHexString(A) + toHexString(B) + toHexString(C) + toHexString(D);
        return digest;
    };

})(AvNs);
