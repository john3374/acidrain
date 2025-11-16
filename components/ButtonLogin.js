'use client';
import { useMutation } from '@tanstack/react-query';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

const Popup = dynamic(() => import('reactjs-popup'), { ssr: false });

const ButtonLogin = () => {
  const { data: session, status, update } = useSession();
  const inputRef = useRef();
  const [nickErr, setNickErr] = useState();

  const { mutate: udpateNickname } = useMutation({
    mutationKey: 'update-nickname',
    mutationFn: ({ nickname }) =>
      fetch('/api/player/checkNickname', {
        method: 'POST',
        body: JSON.stringify({ nickname }),
      }).then(res => res.json()),
  });

  const resetClose = close => {
    setNickErr('');
    close();
  };

  if (status === 'authenticated') {
    // <Link href="/api/auth/signout" target="_blank">    Sign out    </Link>
    // onClick={e => {      e.preventDefault();      signIn('google');    }}
    return (
      <Popup
        trigger={
          <button className="profile button">
            <Image src={session.user.image} alt="player image" width={16} height={16} className="circle" />
            {` ${session.user.nickname || '사용자'}`}
          </button>
        }
        modal
        nested
      >
        {close => (
          <div className="modal">
            <div className="content">
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  const nickname = inputRef.current.value;
                  if (nickname === session.user.nickname) {
                    resetClose(close);
                    return;
                  }
                  if (nickname.length > 7) {
                    setNickErr('별명은 최대 7글자 입니다.');
                    return;
                  }
                  udpateNickname(
                    { nickname },
                    {
                      onSuccess: () => update({ nickname }),
                      onError: err => setNickErr('이미 사용중인 별명입니다.'),
                      onSettled: () => resetClose(close),
                    }
                  );
                }}
              >
                <div>
                  별명
                  <input ref={inputRef} defaultValue={session.user.nickname} maxLength={7} />
                </div>
                <p className="nick-error">{nickErr}</p>
                <div className="modal-button">
                  <button type="submit" className="button">
                    수정
                  </button>
                  <button type="reset" className="button" onClick={() => resetClose(close)}>
                    취소
                  </button>
                  <hr />
                  <button className="button" onClick={() => signOut()}>
                    로그아웃
                  </button>
                  <hr />
                  <button
                    className="button"
                    onClick={() => {
                      signOut();
                      update({ delete: 1 });
                    }}
                  >
                    탈퇴
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Popup>
    );
  }
  return (
    <button
      className="button"
      onClick={e => {
        e.preventDefault();
        signIn();
      }}
    >
      로그인
    </button>
  );
};

export default ButtonLogin;
